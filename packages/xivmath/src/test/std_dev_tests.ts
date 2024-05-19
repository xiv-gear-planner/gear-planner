import {expect} from 'chai';
import {addValues, multiplyValues, ValueWithDev} from "../deviation";

describe('ValueWithDev calculations', () => {

    // Test cases for addValues function
    describe('addValues', () => {

        it('should return expected value and standard deviation for addition of two values', () => {
            const values: ValueWithDev[] = [
                {
                    expected: 3,
                    stdDev: 0.5
                },
                {
                    expected: 5,
                    stdDev: 1.0
                }
            ];
            const result = addValues(...values);
            expect(result.expected).to.equal(8); // 3 + 5
            expect(result.stdDev).to.be.closeTo(Math.sqrt(0.5 ** 2 + 1.0 ** 2), 0.0001);
        });

        it('should return expected value and standard deviation for addition of three values', () => {
            const values: ValueWithDev[] = [
                {
                    expected: 2,
                    stdDev: 0.3
                },
                {
                    expected: 4,
                    stdDev: 0.7
                },
                {
                    expected: 6,
                    stdDev: 0.2
                }
            ];
            const result = addValues(...values);
            expect(result.expected).to.equal(12); // 2 + 4 + 6
            expect(result.stdDev).to.be.closeTo(Math.sqrt(0.3 ** 2 + 0.7 ** 2 + 0.2 ** 2), 0.0001);
        });
    });

    // Test cases for multiplyValues function
    describe('multiplyValues', () => {

        it('should return expected value and standard deviation for multiplication of two values', () => {
            const values: ValueWithDev[] = [
                {
                    expected: 2,
                    stdDev: 0.5
                },
                {
                    expected: 3,
                    stdDev: 0.4
                }
            ];
            const result = multiplyValues(...values);
            expect(result.expected).to.equal(2 * 3); // 2 * 3
            const expectedVariance = ((0.5 ** 2 + 2 ** 2) * (0.4 ** 2 + 3 ** 2)) - (2 ** 2 * 3 ** 2);
            expect(result.stdDev).to.be.closeTo(Math.sqrt(expectedVariance), 0.0000001);
        });

        it('should return expected value and standard deviation for multiplication of three values', () => {
            const values: ValueWithDev[] = [
                {
                    expected: 2,
                    stdDev: 0.2
                },
                {
                    expected: 4,
                    stdDev: 0.3
                },
                {
                    expected: 5,
                    stdDev: 0.4
                }
            ];
            const result = multiplyValues(...values);
            expect(result.expected).to.equal(2 * 4 * 5); // 2 * 4 * 5
            const expectedVariance = (2 ** 2 + 0.2 ** 2) * (4 ** 2 + 0.3 ** 2) * (5 ** 2 + 0.4 ** 2) - (2 ** 2 * 4 ** 2 * 5 ** 2);
            expect(result.stdDev).to.be.closeTo(Math.sqrt(expectedVariance), 0.000000001);
        });
    });

});