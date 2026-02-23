import {MockBisService, DirNode, LeafNode, isLeafNode} from '@xivgear/core/external/static_bis';
import {expect} from 'chai';

describe('MockBisService dynamic index', () => {
    it('should generate index from added sheets', async () => {
        const bis = new MockBisService();
        bis.addSheet(['job1', 'sheet1'], JSON.stringify({
            name: 'Sheet 1',
            description: 'Desc 1',
        }));
        bis.addSheet(['job1', 'sheet2'], JSON.stringify({
            name: 'Sheet 2',
            description: 'Desc 2',
        }));
        bis.addSheet(['job2', 'sub', 'sheet3'], JSON.stringify({
            name: 'Sheet 3',
            description: 'Desc 3',
        }));

        const index = await bis.getBisIndex();

        expect(index.type).to.equal('dir');
        expect(index.children).to.have.lengthOf(2);

        const job1 = index.children.find(n => n.pathPart === 'job1') as DirNode;
        expect(job1.type).to.equal('dir');
        expect(job1.children).to.have.lengthOf(2);

        const sheet1 = job1.children.filter<LeafNode>(isLeafNode).find(n => n.pathPart === 'sheet1');
        expect(sheet1!.type).to.equal('file');
        expect(sheet1!.contentName).to.equal('Sheet 1');
        expect(sheet1!.contentDescription).to.equal('Desc 1');

        const job2 = index.children.find(n => n.pathPart === 'job2') as DirNode;
        const sub = job2.children.find(n => n.pathPart === 'sub') as DirNode;
        const sheet3 = sub.children.filter<LeafNode>(isLeafNode).find(n => n.pathPart === 'sheet3');
        expect(sheet3!.contentName).to.equal('Sheet 3');
    });

    it('should invalidate cache when adding new sheets', async () => {
        const bis = new MockBisService();
        bis.addSheet(['job1', 'sheet1'], JSON.stringify({name: 'Sheet 1'}));

        const index1 = await bis.getBisIndex();
        expect(index1.children).to.have.lengthOf(1);

        bis.addSheet(['job2', 'sheet2'], JSON.stringify({name: 'Sheet 2'}));
        const index2 = await bis.getBisIndex();
        expect(index2.children).to.have.lengthOf(2);
        expect(index1).to.not.equal(index2);
    });
});
