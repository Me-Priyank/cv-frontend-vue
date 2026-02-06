/**
 * K-Map Simplification using Quine-McCluskey Algorithm
 * Minimizes Boolean expressions to reduce gate count
 */

/**
 * Represents a minterm or prime implicant
 */
interface Implicant {
    binary: string      // Binary representation (e.g., "01-1" where - is don't care)
    minterms: number[]  // Original minterms covered
    combined: boolean   // Whether this was combined with another
}

/**
 * Quine-McCluskey Boolean minimization algorithm
 */
export class QuineMcCluskey {
    private numVars: number
    private minterms: number[]
    private dontCares: number[]

    constructor(numVars: number, minterms: number[], dontCares: number[] = []) {
        this.numVars = numVars
        this.minterms = minterms
        this.dontCares = dontCares
    }

    /**
     * Main minimization method - returns simplified SOP expression
     */
    minimize(): string {
        if (this.minterms.length === 0) {
            return '0'
        }

        // Check if all minterms (tautology)
        const maxMinterms = Math.pow(2, this.numVars)
        if (this.minterms.length === maxMinterms) {
            return '1'
        }

        // Step 1: Find prime implicants
        const primeImplicants = this.findPrimeImplicants()

        // Step 2: Find essential prime implicants
        const essentialPIs = this.findEssentialPrimeImplicants(primeImplicants)

        // Step 3: Cover remaining minterms
        const finalPIs = this.coverRemainingMinterms(essentialPIs, primeImplicants)

        // Step 4: Convert to SOP expression
        return this.toExpression(finalPIs)
    }

    /**
     * Step 1: Find all prime implicants using iterative combining
     */
    private findPrimeImplicants(): Implicant[] {
        // Initialize with minterms and don't cares
        const allTerms = [...this.minterms, ...this.dontCares]
        let currentGroup: Implicant[] = allTerms.map(m => ({
            binary: m.toString(2).padStart(this.numVars, '0'),
            minterms: [m],
            combined: false
        }))

        const primeImplicants: Implicant[] = []

        // Keep combining until no more combinations possible
        while (true) {
            const nextGroup: Implicant[] = []
            const usedIndices = new Set<number>()

            // Group by number of 1s
            const groups = this.groupByOnes(currentGroup)

            // Try to combine adjacent groups
            for (let i = 0; i < groups.length - 1; i++) {
                const group1 = groups[i] || []
                const group2 = groups[i + 1] || []

                for (let j = 0; j < group1.length; j++) {
                    for (let k = 0; k < group2.length; k++) {
                        const combined = this.canCombine(group1[j], group2[k])
                        if (combined) {
                            // Mark as combined
                            const idx1 = currentGroup.indexOf(group1[j])
                            const idx2 = currentGroup.indexOf(group2[k])
                            usedIndices.add(idx1)
                            usedIndices.add(idx2)

                            // Check if already in nextGroup
                            const exists = nextGroup.some(imp =>
                                imp.binary === combined.binary
                            )
                            if (!exists) {
                                nextGroup.push(combined)
                            }
                        }
                    }
                }
            }

            // Add uncombined implicants as prime implicants
            for (let i = 0; i < currentGroup.length; i++) {
                if (!usedIndices.has(i)) {
                    // Check if it covers actual minterms (not just don't cares)
                    const coversMinterm = currentGroup[i].minterms.some(m =>
                        this.minterms.includes(m)
                    )
                    if (coversMinterm) {
                        primeImplicants.push(currentGroup[i])
                    }
                }
            }

            if (nextGroup.length === 0) {
                break
            }

            currentGroup = nextGroup
        }

        return primeImplicants
    }

    /**
     * Group implicants by number of 1s in their binary representation
     */
    private groupByOnes(implicants: Implicant[]): Implicant[][] {
        const groups: Implicant[][] = []

        for (const imp of implicants) {
            const ones = imp.binary.split('').filter(c => c === '1').length
            if (!groups[ones]) {
                groups[ones] = []
            }
            groups[ones].push(imp)
        }

        return groups
    }

    /**
     * Check if two implicants can be combined (differ by exactly one bit)
     */
    private canCombine(imp1: Implicant, imp2: Implicant): Implicant | null {
        let diffCount = 0
        let diffIndex = -1

        for (let i = 0; i < imp1.binary.length; i++) {
            if (imp1.binary[i] !== imp2.binary[i]) {
                diffCount++
                diffIndex = i
            }
        }

        if (diffCount !== 1) {
            return null
        }

        // Both must have same value (0 or 1) at diff position, not already '-'
        if (imp1.binary[diffIndex] === '-' || imp2.binary[diffIndex] === '-') {
            return null
        }

        // Create combined implicant with '-' at diff position
        const newBinary =
            imp1.binary.substring(0, diffIndex) +
            '-' +
            imp1.binary.substring(diffIndex + 1)

        return {
            binary: newBinary,
            minterms: [...new Set([...imp1.minterms, ...imp2.minterms])],
            combined: false
        }
    }

    /**
     * Step 2: Find essential prime implicants
     */
    private findEssentialPrimeImplicants(primeImplicants: Implicant[]): Implicant[] {
        const essential: Implicant[] = []
        const coveredMinterms = new Set<number>()

        for (const minterm of this.minterms) {
            // Find which PIs cover this minterm
            const coveringPIs = primeImplicants.filter(pi =>
                pi.minterms.includes(minterm)
            )

            // If only one PI covers this minterm, it's essential
            if (coveringPIs.length === 1) {
                const pi = coveringPIs[0]
                if (!essential.includes(pi)) {
                    essential.push(pi)
                    // Mark all minterms covered by this PI
                    pi.minterms.forEach(m => coveredMinterms.add(m))
                }
            }
        }

        return essential
    }

    /**
     * Step 3: Cover remaining minterms with minimum PIs
     */
    private coverRemainingMinterms(essential: Implicant[], allPIs: Implicant[]): Implicant[] {
        const result = [...essential]
        const covered = new Set<number>()

        // Mark minterms covered by essential PIs
        for (const pi of essential) {
            pi.minterms.forEach(m => covered.add(m))
        }

        // Find uncovered minterms
        const uncovered = this.minterms.filter(m => !covered.has(m))

        // Greedy selection of remaining PIs
        while (uncovered.length > 0) {
            // Find PI that covers most uncovered minterms
            let bestPI: Implicant | null = null
            let bestCount = 0

            for (const pi of allPIs) {
                if (result.includes(pi)) continue

                const coverCount = pi.minterms.filter(m =>
                    uncovered.includes(m)
                ).length

                if (coverCount > bestCount) {
                    bestCount = coverCount
                    bestPI = pi
                }
            }

            if (bestPI) {
                result.push(bestPI)
                // Remove covered minterms from uncovered
                for (const m of bestPI.minterms) {
                    const idx = uncovered.indexOf(m)
                    if (idx !== -1) {
                        uncovered.splice(idx, 1)
                    }
                }
            } else {
                break
            }
        }

        return result
    }

    /**
     * Convert prime implicants to SOP expression
     */
    private toExpression(implicants: Implicant[]): string {
        if (implicants.length === 0) {
            return '0'
        }

        const terms = implicants.map(pi => this.implicantToTerm(pi))
        return terms.join(' + ')
    }

    /**
     * Convert single implicant to product term
     */
    private implicantToTerm(implicant: Implicant): string {
        const literals: string[] = []

        for (let i = 0; i < implicant.binary.length; i++) {
            const varName = `V${i}`
            if (implicant.binary[i] === '1') {
                literals.push(varName)
            } else if (implicant.binary[i] === '0') {
                literals.push(`${varName}'`)
            }
            // '-' means don't care, skip
        }

        if (literals.length === 0) {
            return '1'
        }

        return literals.join('·')
    }
}

/**
 * Simplify a Boolean expression from truth table
 * @param truthTable Array of {inputs, output} where output is 0 or 1
 * @param inputNames Names of input variables
 * @returns Simplified SOP expression
 */
export function simplifyExpression(
    minterms: number[],
    numVars: number,
    varNames: string[]
): string {
    const qm = new QuineMcCluskey(numVars, minterms)
    const simplified = qm.minimize()

    // Replace generic variable names with actual names
    let result = simplified
    for (let i = 0; i < varNames.length; i++) {
        result = result.replace(new RegExp(`V${i}'`, 'g'), `${varNames[i]}'`)
        result = result.replace(new RegExp(`V${i}`, 'g'), varNames[i])
    }

    return result
}

/**
 * Extract minterms from truth table for a specific output
 */
export function extractMinterms(
    truthTable: Array<{ currentState: string; inputs: Record<string, number>; nextState: string }>,
    outputBit: number,
    numVars: number
): number[] {
    const minterms: number[] = []

    for (let i = 0; i < truthTable.length; i++) {
        const row = truthTable[i]
        // Check if this output bit is 1
        const nextStateBits = row.nextState.split('')
        if (nextStateBits[outputBit] === '1') {
            minterms.push(i)
        }
    }

    return minterms
}
