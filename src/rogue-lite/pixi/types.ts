export interface Vec2 {
    x: number;
    y: number;
}

export interface InputState {
    /** Normalized movement vector (magnitude 0..1). */
    move: Vec2;
    /** Normalized aim unit vector. Defaults to {x:1, y:0} (right) when no input. */
    aim: Vec2;
}
