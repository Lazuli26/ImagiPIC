// no-fork-ts-checker.js — replaces fork-ts-checker-webpack-plugin with a no-op v5/v6-compatible plugin.
// Bypasses the broken forked typecheck subprocess on Node 22 + react-scripts 4 + TS 3.8.
//
// Root cause of the "waiting for typecheck results" hang:
//   - react-scripts 4 uses ForkTsCheckerWebpackPlugin which spawns Node child_process.fork()
//   - old TS 3.8 + legacy EVP crypto paths / IPC message pump deadlocks on new Node → subprocess hangs
//   - parent webpack dev server blocks forever waiting for IPC from dead child:
//         tsMessagesPromise = new Promise(...);
//         ... (await tsMessagesPromise) — never resolves → "Files successfully emitted, waiting..." forever
//
// Fix: Intercept ALL require() of "fork-ts-checker-webpack-plugin" → return a no-op plugin class
//      that never spawns a child. Compile event lifecycle is preserved: plugin.apply(compiler) hooks
//      into beforeCompile + done to fire all registered receive.tap callbacks with empty
//      diagnostics tuple ([], []) after the CRA4 beforeCompile hook creates the resolver closure.
//      This matches react-dev-utils/WebpackDevServerUtils.js event order so tsMessagesPromise resolves.
//
// Hooked via: NODE_OPTIONS='--openssl-legacy-provider --require ./scripts/no-fork-ts-checker.js'
//             + DISABLE_FORK_TS_CHECKER=true
// Only activates when DISABLE_FORK_TS_CHECKER is true — production builds still typecheck.
const Module = require('module');

const isEnabled = process.env.DISABLE_FORK_TS_CHECKER === 'true';

// makeHook — infinitely recursing SyncHook-shaped stub.
// Register callbacks via .tap / .tapAsync. Callbacks are NOT auto-fired on registration — they
// are fired by the plugin.apply beforeCompile/done hook registry.fireAll() to guarantee correct
// event order relative to CRA4's beforeCompile hook which sets tsMessagesResolver.
function makeHook(nameHint, registry) {
  const callbacks = [];
  const base = {
    tap: function(name, fn) {
      const cb = typeof name === 'function' ? name : fn;
      if (typeof cb === 'function') callbacks.push(cb);
      return undefined;
    },
    tapAsync: function(name, fn) {
      const cb = typeof name === 'function' ? name : fn;
      if (typeof cb === 'function') {
        callbacks.push(function(...args) {
          try { cb(args.length ? args[args.length - 1] : null); } catch(e) {}
        });
      }
      return undefined;
    },
    tapPromise: async function(name, fn) { return undefined; },
    promise: async function(...args) { return undefined; },
    call: function(...args) { return undefined; },
    callAsync: function(...args) {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') cb();
      return undefined;
    },
    intercept: function() { return this; },
    withOptions: function() { return makeHook(nameHint + '_o', registry); },
    isUsed: function() { return callbacks.length > 0; },
    __callbacks: callbacks,
  };
  if (typeof Proxy !== 'undefined') {
    return new Proxy(base, {
      get(target, prop) {
        if (prop === 'constructor') return Object;
        if (prop === Symbol.toPrimitive) return () => 0;
        if (prop === Symbol.toStringTag) return 'SyncHook';
        if (typeof prop === 'symbol') return undefined;
        if (prop in target || Object.prototype.hasOwnProperty.call(base, prop)) return target[prop];
        const h = makeHook(String(prop), registry);
        if (registry) { registry.__extras = registry.__extras || []; registry.__extras.push(h); }
        return h;
      },
      has() { return true; },
      ownKeys() { return ['tap','tapAsync','tapPromise','promise','call','callAsync','intercept','withOptions','isUsed','__callbacks']; },
    });
  }
  return base;
}

function createNoopHooks(registry) {
  const explicit = {
    waiting: makeHook('waiting', registry),
    canceled: makeHook('canceled', registry),
    running: makeHook('running', registry),
    errors: makeHook('errors', registry),
    warnings: makeHook('warnings', registry),
    start: makeHook('start', registry),
    end: makeHook('end', registry),
    serviceStart: makeHook('serviceStart', registry),
    serviceStartError: makeHook('serviceStartError', registry),
    serviceOutOfMemory: makeHook('serviceOutOfMemory', registry),
    infrastructures: makeHook('infrastructures', registry),
    issues: makeHook('issues', registry),
    receive: makeHook('receive', registry), // react-dev-utils/WebpackDevServerUtils.js:151 hooks here
  };

  registry.__explicit = explicit;
  registry.fireAll = function fireAll(resultShape) {
    const fired = new WeakSet();
    function fireHook(h) {
      try {
        const cbs = (h && h.__callbacks) || [];
        if (fired.has(cbs)) return;
        fired.add(cbs);
        for (let i = 0; i < cbs.length; i++) {
          try { if (typeof cbs[i] === 'function') cbs[i].apply(undefined, resultShape); } catch(e) {}
        }
      } catch (e) {}
    }
    for (const k of Object.keys(explicit)) fireHook(explicit[k]);
    if (registry.__extras) for (let i = 0; i < registry.__extras.length; i++) fireHook(registry.__extras[i]);
  };

  if (typeof Proxy === 'undefined') return explicit;
  return new Proxy(explicit, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop in explicit || Object.prototype.hasOwnProperty.call(explicit, prop)) return explicit[prop];
      const h = makeHook(String(prop), registry);
      registry.__extras = registry.__extras || [];
      registry.__extras.push(h);
      return h;
    },
    has() { return true; },
    ownKeys() { return Object.keys(explicit); },
    getOwnPropertyDescriptor(t, p) {
      if (p in explicit) return Object.getOwnPropertyDescriptor(explicit, p);
      const h = makeHook(String(p), registry);
      registry.__extras = registry.__extras || [];
      registry.__extras.push(h);
      return { configurable: true, enumerable: true, value: h };
    },
  });
}

class NoopForkTsChecker {
  constructor(options) { this.options = options || {}; }
  apply(compiler) {
    // CRITICAL: CRA4 calls NoopForkTsChecker.getCompilerHooks(compiler) as a STATIC call
    // (react-dev-utils/WebpackDevServerUtils.js:149-151). The static getCompilerHooks below creates and
    // attaches a registry + hooks object to compiler.__forkTsCheckerRegistry. We MUST read back that
    // SHARED registry from compiler.__forkTsCheckerRegistry (NOT create a new one on this instance).
    const registry = (compiler.__forkTsCheckerRegistry) || NoopForkTsChecker.getCompilerHooks(compiler) && compiler.__forkTsCheckerRegistry;
    if (!registry) return;

    if (compiler.hooks && compiler.hooks.make) {
      try {
        // 'make' runs AFTER beforeCompile for every compile (including first one).
        compiler.hooks.make.tapAsync('NoopForkTsCheckerMake', function(compilation, cb) {
          Promise.resolve().then(function() {
            if (registry.fireAll) {
              // receive.tap callback expects (diagnostics[], lints[]) → tsMessagesResolver({errors: filter(...errors), warnings: filter(...warnings)})
              try { registry.fireAll([[], []]); } catch (e) {}
            }
          });
          cb();
        });
      } catch (e) {}
      try {
        compiler.hooks.done.tap('NoopForkTsCheckerDone', function() {
          if (registry.fireAll) try { registry.fireAll([[], []]); } catch (e) {}
        });
      } catch (e) {}
    }
  }
  static getCompilerHooks(compiler) {
    if (!compiler.__forkTsCheckerHooks) {
      // One SHARED registry per compiler — accessible to both static callers (CRA4 taps here)
      // and instance apply() callers (fireAll callbacks via make/done hooks).
      const registry = { __extras: [] };
      compiler.__forkTsCheckerHooks = createNoopHooks(registry);
      compiler.__forkTsCheckerRegistry = registry;
    }
    return compiler.__forkTsCheckerHooks;
  }
}
NoopForkTsChecker.createJsonRpcServer = function() { return { listen: function() {}, dispose: function() {} }; };

if (isEnabled) {
  // Module._load interception — matches both exact import 'fork-ts-checker-webpack-plugin' and any
  // deep require like '/abs/node_modules/fork-ts-checker-webpack-plugin/lib/index.js' (when required
  // via transitive paths like react-dev-utils/ForkTsCheckerWebpackPlugin which is just a re-export).
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (typeof request === 'string') {
      const simple = request === 'fork-ts-checker-webpack-plugin';
      const pathy = request.indexOf('fork-ts-checker-webpack-plugin') !== -1 &&
        (request.endsWith('.js') || /[\\/]index\.js$/.test(request) || /[\\/]ForkTsCheckerWebpackPlugin\.js$/.test(request));
      if (simple || pathy) return NoopForkTsChecker;
    }
    return originalLoad.apply(this, arguments);
  };
}

module.exports = NoopForkTsChecker;
module.exports.default = NoopForkTsChecker;
