import { Effect, ShaderUniform } from '../types.js';

export class EffectStack {
    private effects: Effect[] = [];
    private enabled: boolean = true;
    
    addEffect(effect: Effect): void {
        this.effects.push(effect);
    }
    
    removeEffect(effectId: string): boolean {
        const index = this.effects.findIndex(effect => effect.id === effectId);
        if (index !== -1) {
            this.effects.splice(index, 1);
            return true;
        }
        return false;
    }
    
    getEffect(effectId: string): Effect | undefined {
        return this.effects.find(effect => effect.id === effectId);
    }
    
    updateEffect(effectId: string, uniforms: Record<string, ShaderUniform>): boolean {
        const effect = this.getEffect(effectId);
        if (effect) {
            Object.assign(effect.uniforms, uniforms);
            return true;
        }
        return false;
    }
    
    toggleEffect(effectId: string): boolean {
        const effect = this.getEffect(effectId);
        if (effect) {
            effect.enabled = !effect.enabled;
            return true;
        }
        return false;
    }
    
    setEffectEnabled(effectId: string, enabled: boolean): boolean {
        const effect = this.getEffect(effectId);
        if (effect) {
            effect.enabled = enabled;
            return true;
        }
        return false;
    }
    
    getActiveEffects(): Effect[] {
        if (!this.enabled) return [];
        return this.effects.filter(effect => effect.enabled);
    }
    
    getAllEffects(): Effect[] {
        return [...this.effects];
    }
    
    clearEffects(): void {
        this.effects = [];
    }
    
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
    
    isEnabled(): boolean {
        return this.enabled;
    }
    
    // Reorder effects (change rendering order)
    moveEffect(effectId: string, newIndex: number): boolean {
        const index = this.effects.findIndex(effect => effect.id === effectId);
        if (index === -1) return false;
        
        if (newIndex < 0 || newIndex >= this.effects.length) return false;
        
        const [effect] = this.effects.splice(index, 1);
        this.effects.splice(newIndex, 0, effect);
        
        return true;
    }
    
    // Duplicate an effect
    duplicateEffect(effectId: string): string | null {
        const effect = this.getEffect(effectId);
        if (!effect) return null;
        
        const duplicatedEffect: Effect = {
            ...effect,
            id: `${effect.id}_copy_${Date.now()}`,
            uniforms: { ...effect.uniforms }
        };
        
        this.addEffect(duplicatedEffect);
        return duplicatedEffect.id;
    }
    
    // Get effect chain as array (for rendering)
    getEffectChain(): Effect[] {
        return this.getActiveEffects();
    }
}

export class ClipEffectStack extends EffectStack {
    private clipId: string;
    
    constructor(clipId: string) {
        super();
        this.clipId = clipId;
    }
    
    getClipId(): string {
        return this.clipId;
    }
}

export class AdjustmentLayerStack extends EffectStack {
    private trackId: string;
    private affectsBelow: boolean = true;
    
    constructor(trackId: string, affectsBelow: boolean = true) {
        super();
        this.trackId = trackId;
        this.affectsBelow = affectsBelow;
    }
    
    getTrackId(): string {
        return this.trackId;
    }
    
    affectsTracksBelow(): boolean {
        return this.affectsBelow;
    }
    
    setAffectsBelow(affectsBelow: boolean): void {
        this.affectsBelow = affectsBelow;
    }
}