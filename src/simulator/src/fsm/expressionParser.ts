/**
 * Expression Parser for FSM Boolean Expressions
 * 
 * Parses Sum-of-Products expressions like: Q0'·X' + Q0·X
 * Produces a structured representation for circuit generation
 */

/**
 * Represents an expression tree node
 */
export type ExpressionNode =
    | { type: 'VAR'; name: string; inverted: boolean }
    | { type: 'AND'; operands: ExpressionNode[] }
    | { type: 'OR'; operands: ExpressionNode[] }
    | { type: 'CONST'; value: 0 | 1 };

/**
 * Parsed expression result
 */
export interface ParsedExpression {
    root: ExpressionNode;
    variables: Set<string>;        // All unique variables (e.g., Q0, X)
    invertedVars: Set<string>;     // Variables that need NOT gates (e.g., Q0, X when Q0' or X' appears)
}

/**
 * Parse a Sum-of-Products expression into an expression tree
 * 
 * Format:
 * - Variables: Q0, Q1, X, Y etc.
 * - NOT: suffix ' (e.g., Q0')
 * - AND: · (middle dot)
 * - OR: + with spaces (e.g., " + ")
 * 
 * Example: "Q0'·X' + Q0·X" becomes:
 * {
 *   type: 'OR',
 *   operands: [
 *     { type: 'AND', operands: [{ type: 'VAR', name: 'Q0', inverted: true }, { type: 'VAR', name: 'X', inverted: true }] },
 *     { type: 'AND', operands: [{ type: 'VAR', name: 'Q0', inverted: false }, { type: 'VAR', name: 'X', inverted: false }] }
 *   ]
 * }
 */
export function parseExpression(expr: string): ParsedExpression {
    const variables = new Set<string>();
    const invertedVars = new Set<string>();

    // Handle constant expressions
    if (expr === '0') {
        return {
            root: { type: 'CONST', value: 0 },
            variables,
            invertedVars
        };
    }
    if (expr === '1') {
        return {
            root: { type: 'CONST', value: 1 },
            variables,
            invertedVars
        };
    }

    // Split by OR operator (+ with spaces)
    const terms = expr.split(' + ');

    const orOperands: ExpressionNode[] = [];

    for (const term of terms) {
        // Split by AND operator (·)
        const factors = term.split('·');

        const andOperands: ExpressionNode[] = [];

        for (const factor of factors) {
            const trimmed = factor.trim();
            if (!trimmed) continue;

            // Check if inverted (ends with ')
            const inverted = trimmed.endsWith("'");
            const varName = inverted ? trimmed.slice(0, -1) : trimmed;

            variables.add(varName);
            if (inverted) {
                invertedVars.add(varName);
            }

            andOperands.push({
                type: 'VAR',
                name: varName,
                inverted
            });
        }

        // If only one factor, no AND needed
        if (andOperands.length === 1) {
            orOperands.push(andOperands[0]);
        } else if (andOperands.length > 1) {
            orOperands.push({
                type: 'AND',
                operands: andOperands
            });
        }
    }

    // Build root
    let root: ExpressionNode;
    if (orOperands.length === 0) {
        root = { type: 'CONST', value: 0 };
    } else if (orOperands.length === 1) {
        root = orOperands[0];
    } else {
        root = { type: 'OR', operands: orOperands };
    }

    return { root, variables, invertedVars };
}

/**
 * Count the number of gates needed for an expression
 */
export function countGates(expr: ParsedExpression): { and: number; or: number; not: number } {
    let and = 0;
    let or = 0;
    const not = expr.invertedVars.size;

    function count(node: ExpressionNode): void {
        switch (node.type) {
            case 'AND':
                and++;
                node.operands.forEach(count);
                break;
            case 'OR':
                or++;
                node.operands.forEach(count);
                break;
            // VAR and CONST don't add gates
        }
    }

    count(expr.root);
    return { and, or, not };
}

/**
 * Flatten an expression into product terms for circuit layout
 * Returns array of product terms, where each term is an array of variable references
 */
export interface ProductTerm {
    variables: Array<{ name: string; inverted: boolean }>;
}

export function getProductTerms(expr: ParsedExpression): ProductTerm[] {
    const terms: ProductTerm[] = [];

    function extractTerms(node: ExpressionNode): void {
        switch (node.type) {
            case 'OR':
                node.operands.forEach(extractTerms);
                break;
            case 'AND':
                terms.push({
                    variables: node.operands
                        .filter((op): op is { type: 'VAR'; name: string; inverted: boolean } => op.type === 'VAR')
                        .map(v => ({ name: v.name, inverted: v.inverted }))
                });
                break;
            case 'VAR':
                // Single variable term (no AND)
                terms.push({
                    variables: [{ name: node.name, inverted: node.inverted }]
                });
                break;
            case 'CONST':
                // Constant - no term
                break;
        }
    }

    extractTerms(expr.root);
    return terms;
}
