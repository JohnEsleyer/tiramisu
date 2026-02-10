export class EffectStack {
    constructor() {
        this.effects = [];
        this.enabled = true;
    }
    addEffect(effect) {
        this.effects.push(effect);
    }
    removeEffect(effectId) {
        const index = this.effects.findIndex(effect => effect.id === effectId);
        if (index !== -1) {
            this.effects.splice(index, 1);
            return true;
        }
        return false;
    }
    getEffect(effectId) {
        return this.effects.find(effect => effect.id === effectId);
    }
    updateEffect(effectId, uniforms) {
        const effect = this.getEffect(effectId);
        if (effect) {
            Object.assign(effect.uniforms, uniforms);
            return true;
        }
        return false;
    }
    toggleEffect(effectId) {
        const effect = this.getEffect(effectId);
        if (effect) {
            effect.enabled = !effect.enabled;
            return true;
        }
        return false;
    }
    setEffectEnabled(effectId, enabled) {
        const effect = this.getEffect(effectId);
        if (effect) {
            effect.enabled = enabled;
            return true;
        }
        return false;
    }
    getActiveEffects() {
        if (!this.enabled)
            return [];
        return this.effects.filter(effect => effect.enabled);
    }
    getAllEffects() {
        return [...this.effects];
    }
    clearEffects() {
        this.effects = [];
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    isEnabled() {
        return this.enabled;
    }
    // Reorder effects (change rendering order)
    moveEffect(effectId, newIndex) {
        const index = this.effects.findIndex(effect => effect.id === effectId);
        if (index === -1)
            return false;
        if (newIndex < 0 || newIndex >= this.effects.length)
            return false;
        const [effect] = this.effects.splice(index, 1);
        this.effects.splice(newIndex, 0, effect);
        return true;
    }
    // Duplicate an effect
    duplicateEffect(effectId) {
        const effect = this.getEffect(effectId);
        if (!effect)
            return null;
        const duplicatedEffect = {
            ...effect,
            id: `${effect.id}_copy_${Date.now()}`,
            uniforms: { ...effect.uniforms }
        };
        this.addEffect(duplicatedEffect);
        return duplicatedEffect.id;
    }
    // Get effect chain as array (for rendering)
    getEffectChain() {
        return this.getActiveEffects();
    }
}
export class ClipEffectStack extends EffectStack {
    constructor(clipId) {
        super();
        this.clipId = clipId;
    }
    getClipId() {
        return this.clipId;
    }
}
export class AdjustmentLayerStack extends EffectStack {
    constructor(trackId, affectsBelow = true) {
        super();
        this.affectsBelow = true;
        this.trackId = trackId;
        this.affectsBelow = affectsBelow;
    }
    getTrackId() {
        return this.trackId;
    }
    affectsTracksBelow() {
        return this.affectsBelow;
    }
    setAffectsBelow(affectsBelow) {
        this.affectsBelow = affectsBelow;
    }
}
