import {describe, expect, test} from "bun:test";
import { getSourceDirContent } from '../files'

describe('getSourceDirContent', () => {
    test('list dir content', () => {
        const dirContent = getSourceDirContent('data')
        expect(dirContent).toHaveLength(2)
        expect(dirContent).toContain('FOLDER_1')
        expect(dirContent).toContain('FOLDER_2')
    })
    test('list dir content with hidden files', () => {
        const dirContent = getSourceDirContent('data',  true)
        expect(dirContent).toHaveLength(3)
        expect(dirContent).toContain('.gitkeep')
    })
})
describe('getSourceDirContent', () => {
    test('list dir content', () => {
        const dirContent = getSourceDirContent('data')
        expect(dirContent).toHaveLength(2)
        expect(dirContent).toContain('FOLDER_1')
        expect(dirContent).toContain('FOLDER_2')
    })
    test('list dir content with hidden files', () => {
        const dirContent = getSourceDirContent('data',  true)
        expect(dirContent).toHaveLength(3)
        expect(dirContent).toContain('.gitkeep')
    })
})
