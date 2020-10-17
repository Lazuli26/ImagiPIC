import { langs } from "../lang";

const CHANGE_LANG = "CHANGE_LANG";
export interface LangState {
    current: keyof typeof langs
}

interface ChangeLang_ACTION {
    type: typeof CHANGE_LANG,
    lang: keyof typeof langs
}
export function ChangeLang(lang: keyof typeof langs): ChangeLang_ACTION {
    return {
        type: CHANGE_LANG,
        lang: lang
    }
}
export function Language(state: LangState = { current: "es" }, action: ChangeLang_ACTION): LangState {
    switch (action.type) {
        case CHANGE_LANG:
            return { ...state, current: action.lang } ;
        default:
            return state;
    }
}