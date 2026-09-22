import 'global-jsdom/register';
import {expect} from "chai";
import {bold, elt, p} from "../components/templates";

describe('templates tests', () => {
    it('should create an element with elt', () => {
        const template = elt('div');
        const element = template`Hello World`;
        expect(element).to.be.instanceOf(HTMLDivElement);
        expect(element.tagName).to.equal('DIV');
        expect(element.textContent).to.equal('Hello World');
    });

    it('should handle string substitutions', () => {
        const template = elt('span');
        const name = 'Junie';
        const element = template`Hello ${name}!`;
        expect(element.textContent).to.equal('Hello Junie!');
    });

    it('should handle numeric and bigint substitutions', () => {
        const template = elt('div');
        const val1 = 123;
        const val2 = 456n;
        const element = template`${val1} and ${val2}`;
        expect(element.textContent).to.equal('123 and 456');
    });

    it('should handle Node substitutions', () => {
        const template = elt('div');
        const inner = document.createElement('span');
        inner.textContent = 'inner';
        const element = template`Outer ${inner} Outer`;
        expect(element.childNodes.length).to.equal(3);
        expect(element.childNodes[0].textContent).to.equal('Outer ');
        expect(element.childNodes[1]).to.equal(inner);
        expect(element.childNodes[2].textContent).to.equal(' Outer');
    });

    it('should handle objects with toString method', () => {
        const template = elt('div');
        const obj = {
            toString: () => 'Custom Object',
            other: 'property',
        };
        const element = template`Result: ${obj}`;
        expect(element.textContent).to.equal('Result: Custom Object');
    });

    it('should apply options to the element', () => {
        const template = elt('div', {
            class: 'my-class',
            id: 'my-id',
            title: 'my-title',
        });
        const element = template`Content`;
        expect(element.className).to.equal('my-class');
        expect(element.id).to.equal('my-id');
        expect(element.title).to.equal('my-title');
    });

    it('should support nested templates', () => {
        const element = p`This is ${bold`bold`} text.`;
        expect(element.tagName).to.equal('P');
        expect(element.childNodes.length).to.equal(3);
        expect(element.childNodes[0].textContent).to.equal('This is ');
        expect((element.childNodes[1] as HTMLElement).tagName).to.equal('B');
        expect(element.childNodes[1].textContent).to.equal('bold');
        expect(element.childNodes[2].textContent).to.equal(' text.');
    });

    it('should work with bold and p constants', () => {
        const bElem = bold`bold content`;
        expect(bElem.tagName).to.equal('B');
        expect(bElem.textContent).to.equal('bold content');

        const pElem = p`paragraph content`;
        expect(pElem.tagName).to.equal('P');
        expect(pElem.textContent).to.equal('paragraph content');
    });

    it('should handle multiple substitutions and mixed types', () => {
        const inner = document.createElement('i');
        inner.textContent = 'italics';
        const element = elt('div')`Start ${1} ${inner} ${'end'}`;
        expect(element.textContent).to.equal('Start 1 italics end');
        expect(element.childNodes.length).to.equal(7); // "Start ", 1, " ", inner, " ", "end", ""
    });

    it('should handle edge cases like empty strings and consecutive substitutions', () => {
        const element = elt('div')`${'a'}${'b'}${'c'}`;
        expect(element.textContent).to.equal('abc');
        expect(element.childNodes.length).to.equal(7); // "", "a", "", "b", "", "c", ""
    });

    it('should handle complex mixed inputs', () => {
        const obj = { toString: () => "OBJ" };
        const node = document.createElement('span');
        node.textContent = "NODE";
        const element = elt('div')`A${1}B${obj}C${node}D`;
        expect(element.textContent).to.equal('A1BOBJCNODED');
    });
});
