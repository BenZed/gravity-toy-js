import SortedArray from '@benzed/array/sorted-array'
import { min, V2 } from '@benzed/math'
import { TICK_DURATION } from './constants'

import { Body, BodyDataWithId, BodyEdge } from './body'
import { Simulation, SimulationData } from './simulation'

/* eslint-disable @typescript-eslint/no-var-requires */

type OverlapId = `${number}:${number}`

// TODO Move Me

const byMass = (a: Body, b: Body) =>
    a.mass > b.mass ? -1 : a.mass < b.mass ? 1 : 0

//// Main ////

/**
 * Does the actual magic of integrating bodies and colliding them
 */
class SimulationPhysical extends Simulation<Body> {
    private readonly _pseudoBodies = new SortedArray<Body>()
    private readonly _realBodies = new SortedArray<Body>()

    private readonly _livingBodies = new SortedArray<Body>()

    private readonly _bodyBounds = {
        x: new SortedArray<BodyEdge>(),
        y: new SortedArray<BodyEdge>(),
        overlaps: new Map<OverlapId, [Body, Body]>()
    } as const

    // Construct

    public constructor(settings?: Partial<SimulationData>) {
        super(settings)
        this._update = this._update.bind(this)
    }

    // Main Interface

    private _isRunning = false
    public get isRunning(): boolean {
        return this._isRunning
    }

    public run(): void {
        this._isRunning = true

        this._livingBodies.length = 0
        this._livingBodies.push(...this.bodies)

        void this._update()
    }

    public stop(): void {
        this._isRunning = false
    }

    // Helper

    protected _createBody(json: BodyDataWithId): Body {
        return new Body(json)
    }

    protected _update(): void {
        for (let i = 0; i < this.physicsSteps; i++) {
            this._updateBodyBoundsAndOverlaps()
            this._applyCollisions()
            this._calculateForces()
            this._applyForces()
        }

        this.emit('tick', this._livingBodies)

        if (this._isRunning) setTimeout(this._update, 0)
    }

    // Helper

    private _updateBodyBoundsAndOverlaps() {
        for (const body of this._livingBodies) body.updateBounds()

        for (const edges of [this._bodyBounds.x, this._bodyBounds.y]) {
            edges.sort((e1, e2) => {
                const above = e1 >= e2
                if (above) this._updateOverlap(e1.body, e2.body)

                return above ? 1 : -1
            })
        }
    }

    private _updateOverlap(b1: Body, b2: Body) {
        if (b1 === b2) return

        const overlapId = `${b1.id}:${b2.id}` as const

        const { overlaps } = this._bodyBounds

        const wasOverlapping = overlaps.has(overlapId)
        const isOverlapping = b1.isOverlapping(b2)

        if (wasOverlapping && !isOverlapping) overlaps.delete(overlapId)
        else if (!wasOverlapping && isOverlapping)
            overlaps.set(overlapId, [b1, b2])
    }

    private _applyCollisions() {
        let needsSort = false

        const { overlaps } = this._bodyBounds

        for (const [overlapId, [b1, b2]] of [...overlaps]) {
            // If either body was destroyed in another collision
            if (b1.mass <= 0 || b2.mass <= 0) overlaps.delete(overlapId)
            else if (b1.isColliding(b2)) {
                overlaps.delete(overlapId)

                this._applyCollision(b1, b2)
                needsSort = true
            }
        }

        if (needsSort) this._sortBodies()
    }

    private _applyCollision(...bodies: [Body, Body]) {
        const [big, small] = bodies.sort(byMass)

        const totalMass = big.mass + small.mass
        big.pos
            .mult(big.mass)
            .add(small.pos.copy().mult(small.mass))
            .div(totalMass)

        big.vel
            .mult(big.mass)
            .add(small.vel.copy().mult(small.mass))
            .div(totalMass)

        big.mass = totalMass

        small.mass = 0
        // small.merge = big

        const { _bodyBounds: bodyBounds } = this

        for (const edge of small) {
            const edges = bodyBounds[edge.axis]
            edges.splice(edges.indexOf(edge), 1)
        }
    }

    private _calculateForces() {
        const {
            _livingBodies: livingBodies,
            _pseudoBodies: pseudoBodies,
            _realBodies: realBodies
        } = this

        for (const body of livingBodies) body.pseudoMass = 0

        for (const body of pseudoBodies) this._calculateForce(body, false, true)

        for (const body of pseudoBodies)
            this._calculateForce(body, false, false)

        for (const body of realBodies) this._calculateForce(body, true, false)
    }

    private _calculateForce(
        body: Body,
        isReal: boolean,
        addPseudoMassOnly: boolean
    ) {
        const { _realBodies: realBodies } = this

        // Reset Forces
        if (!addPseudoMassOnly) body.force.set(V2.ZERO)

        let mostAttracted: Body | null = null
        let highestAttraction = -Infinity

        for (const other of realBodies) {
            if (body === other) continue

            const relative = other.pos.copy().sub(body.pos)

            const mass = addPseudoMassOnly
                ? other.mass
                : other.mass + other.pseudoMass

            const attraction = (this.g * mass) / relative.sqrMagnitude
            if (highestAttraction < attraction) {
                highestAttraction = attraction
                mostAttracted = other
            }

            if (!addPseudoMassOnly) {
                const dist = relative.magnitude
                body.force.add(relative.mult(attraction).div(dist))
            }
        }

        if (addPseudoMassOnly && !isReal && mostAttracted)
            mostAttracted.pseudoMass += body.mass
    }

    private _applyForces() {
        const { _livingBodies: livingBodies } = this

        for (const body of livingBodies) {
            body.force.mult(TICK_DURATION).div(this.physicsSteps)

            body.vel.add(body.vel.copy().add(body.force)).mult(0.5)

            body.pos.add(body.vel.copy().div(this.physicsSteps))
        }
    }

    private _sortBodies() {
        const {
            _livingBodies: livingBodies,
            _realBodies: realBodies,
            _pseudoBodies: pseudoBodies,

            realBodiesMin,
            realMassThreshold
        } = this

        realBodies.length = 0
        pseudoBodies.length = 0
        if (livingBodies.length === 0) return

        // largest at 0, smallest at last
        livingBodies.sort(byMass)

        const minRealIndex = min(realBodiesMin, this._livingBodies.length)

        for (let i = 0; i < this._livingBodies.length; i++) {
            //
            const livingBody = this._livingBodies[i]

            // If we encounter a destroyed body, then all future bodies will also be
            // destroyed, and they shouldn't be added to the real or pseudo arrays
            if (livingBody.mass <= 0) break

            // if we haven't gotten to the minRealIndex yet, then this is considered
            // a real body. If we have, then this body's mass must be under the
            // realMassThreshold
            const isReal =
                i < minRealIndex || livingBody.mass >= realMassThreshold
            if (isReal) realBodies.push(livingBody)
            else pseudoBodies.push(livingBody)
        }

        // destroyed bodies have zero mass and since we're sorted by mass they'll
        // all be at the end of the array. While there are still destroyed bodies at
        // the end of the all array, pop them and place them in the destroyed array
        while ((livingBodies.at(-1) as Body).mass <= 0) {
            livingBodies.pop()
        }
    }
}

//// Exports ////

export { SimulationPhysical }
