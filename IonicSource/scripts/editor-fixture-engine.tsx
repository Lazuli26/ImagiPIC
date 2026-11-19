// Test-only Geometrize boundary. The editor, image normalization and Ionic
// overlays are real; deterministic shapes avoid expensive worker computation.
import React, { useEffect } from 'react';

export class GeometrizeController {
  private types: number[] = [];
  async initialize(_image: string, options: any) { this.types = options.shapeTypes; return { width: 100, height: 100 }; }
  async step() { return []; }
  async getShapesCompact() {
    return this.types.map((_type, index) => [6, 0xffd78bff, 4, index * 12, index * 12, 40, 40]);
  }
  dispose() {}
}

export const GeoPlayer = ({ playerUiRef }: any) => {
  useEffect(() => {
    let cap = 250;
    let options = {};
    playerUiRef.current = {
      options: (value: any) => { if (value) options = value; return options; },
      set_cap: (value: number) => { cap = value; },
      background_loading: () => {}, play_pause: () => {},
      set_image: async () => true, get_JSON_shapes: async () => [],
      ControllerInstance: { current: {
        currentBitMap: { width: 100, height: 100 },
        getShapesCompact: async () => Array.from({ length: cap }, (_, index) => [6, 255, 4, index % 90, index % 90, 10, 10]),
      } },
    };
    return () => { playerUiRef.current = null; };
  }, [playerUiRef]);
  return null;
};
