"use strict";

import * as utils from "../utils.js";
const ShaderFactory = await utils.importInShellOnly("./ShaderFactory.js");
const _ = await utils.importGettext();

export default class Effect {
  constructor() {
    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
      shader._uBlackHoleWidth = shader.get_uniform_location("uBlackHoleWidth");
      shader._uBlackHoleActorScale =
        shader.get_uniform_location("uBlackHoleActorScale");

      shader.connect("begin-animation", (shader, settings, forOpening, testMode, actor) => {
        shader.set_uniform_float(shader._uBlackHoleWidth, 1, [
          settings.get_double("black-hole-width"),
        ]);
        shader.set_uniform_float(shader._uBlackHoleActorScale, 1, [
          Effect._getWholeScreenScale(actor),
        ]);
      });
    });
  }

  static getMinShellVersion() { return [3, 36]; }
  static getNick() { return "black-hole"; }
  static getLabel() { return _("Black Hole Void"); }

  static bindPreferences(dialog) {
    dialog.bindAdjustment('black-hole-animation-time');
    dialog.bindAdjustment('black-hole-width');
  }

  static _getWholeScreenScale(actor) {
    const stage = global.stage;
    const [actorX, actorY] = actor.get_transformed_position();
    const centerX = actorX + actor.width / 2;
    const centerY = actorY + actor.height / 2;
    const neededWidth = 2 * Math.max(centerX, stage.width - centerX);
    const neededHeight = 2 * Math.max(centerY, stage.height - centerY);
    const scale = 1.15 * Math.max(
      neededWidth / Math.max(actor.width, 1),
      neededHeight / Math.max(actor.height, 1));

    return scale;
  }

  static getActorScale(settings, forOpening, actor) {
    const scale = Effect._getWholeScreenScale(actor);

    return { x: scale, y: scale };
  }
}
