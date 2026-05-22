import { Injectable } from '@angular/core';
import Matter from 'matter-js';
import type { BlockPlacement, BlockKind } from '../../game.types';
import { getBlockType } from '../data/block-types';

@Injectable({providedIn: 'root'})
export class PhysicsService {
    private engine: Matter.Engine | null = null;
    private runner: Matter.Runner | null = null;
    private render: Matter.Render | null = null;

    createEngine(element: HTMLCanvasElement, canvasWidth: number, canvasHeight: number): Matter.Engine {
        this.engine = Matter.Engine.create({
            gravity: {x: 0, y: 1},
        });
        this.runner = Matter.Runner.create();

        this.render = Matter.Render.create({
            canvas: element,
            engine: this.engine,
            options: {
                width: canvasWidth,
                height: canvasHeight,
                wireframes: false,
                hasBounds: true,
            },
        });

        return this.engine;
    }

    getRender(): Matter.Render | undefined {
        return this.render;
    }

    getEngine(): Matter.Engine | null {
        return this.engine;
    }

    getRunner(): Matter.Runner | null {
        return this.runner;
    }

    startRunner(): void {
        if (this.engine && this.runner) {
            Matter.Runner.run(this.runner, this.engine);
        }
    }

    stopRunner(): void {
        if (this.runner) {
            Matter.Runner.stop(this.runner);
        }
    }

    // Create blocks from a placement list
    createBlocks(placements: BlockPlacement[], mult: number): Matter.Body[] {
        if (!this.engine) return [];
        const bodies: Matter.Body[] = [];
        for (const placement of placements) {
            const blockType = getBlockType(placement.type);
            const width = blockType.width * mult;
            const height = blockType.height * mult;

            console.log(`Placing block dim (${width}, ${height})`);

            const body = Matter.Bodies.rectangle(
                placement.x,
                placement.y,
                width, height,
                {
                    angle: placement.rotation * (Math.PI / 180),
                    friction: blockType.friction,
                    density: blockType.density,
                    render: {fillStyle: blockType.color},
                },
            );
            Matter.World.add(this.engine.world, body);
            bodies.push(body);
        }
        return bodies;
    }

    createBlock(placement: BlockPlacement, mult: number) {
        const blockType = getBlockType(placement.type);
        const width = blockType.width * mult;
        const height = blockType.height * mult;

        console.log(`Placing block dim (${width}, ${height})`);

        const body = Matter.Bodies.rectangle(
            placement.x,
            placement.y,
            width, height,
            {
                angle: placement.rotation * (Math.PI / 180),
                friction: blockType.friction,
                density: blockType.density,
                render: {fillStyle: blockType.color},
            },
        );
        Matter.World.add(this.engine.world, body);
    }

    // Create the heart object
    createHeart(x: number, y: number): Matter.Body {
        if (!this.engine) return Matter.Bodies.circle(x, y, 20);
        const heart = Matter.Bodies.circle(x, y, 20, {
            isStatic: true,
            isSensor: true,
            label: 'heart',
            render: {fillStyle: '#e94560'},
        });
        Matter.World.add(this.engine.world, heart);
        return heart;
    }

    // Create the slingshot projectile
    createProjectile(x: number, y: number, type: string = 'normal'): Matter.Body {
        if (!this.engine) return Matter.Bodies.circle(x, y, 10);
        let mass = 1;
        let radius = 10;
        let color = '#f39c12';
        if (type === 'heavy') {
            mass = 3;
            radius = 14;
            color = '#333';
        }
        if (type === 'explosive') {
            mass = 1.5;
            radius = 12;
            color = '#CC0000';
        }
        const projectile = Matter.Bodies.circle(x, y, radius, {
            mass,
            restitution: 0.3,
            friction: 0.5,
            label: 'projectile',
            render: {fillStyle: color},
        });
        Matter.World.add(this.engine.world, projectile);
        return projectile;
    }

    destroyWorld(): void {
        if (this.engine) {
            Matter.World.clear(this.engine.world, false);
            Matter.Engine.clear(this.engine);
            this.engine = null;
        }
        this.stopRunner();
    }

    getPositions(): { x: number; y: number; angle: number }[] {
        if (!this.engine) return [];
        const bodies = Matter.World.allBodies(this.engine.world);
        return bodies.map((b) => ({x: b.position.x, y: b.position.y, angle: b.angle}));
    }
}
