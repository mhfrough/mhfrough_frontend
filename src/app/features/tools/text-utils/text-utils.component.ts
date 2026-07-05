import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

type Mode = 'case' | 'slug' | 'counter' | 'lorem';
type LoremMode = 'paragraphs' | 'sentences' | 'words';

const LOREM_WORDS = (
    'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore ' +
    'et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ' +
    'ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat ' +
    'nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt ' +
    'mollit anim id est laborum'
).split(' ');

@Component({
    selector: 'app-text-utils',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './text-utils.component.html',
    styleUrl: './text-utils.component.scss',
})
export class TextUtilsComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly mode = signal<Mode>('case');

    // Case
    readonly caseInput = signal('');
    readonly caseOutput = signal('');

    // Slug
    readonly slugInput = signal('');
    readonly slugOutput = computed(() => this.slugify(this.slugInput()));

    // Counter
    readonly counterInput = signal('');
    readonly counterStats = computed(() => {
        const text = this.counterInput();
        const words = text.split(/\s+/).filter(Boolean);
        const sentences = text.split(/[.!?]+\s|[.!?]+$/).filter((s) => s.trim().length > 0);
        const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
        const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean));
        return {
            chars: text.length,
            charsNoSpaces: text.replace(/\s/g, '').length,
            words: words.length,
            sentences: sentences.length,
            paragraphs: paragraphs.length,
            uniqueWords: unique.size,
            readingMin: Math.ceil(words.length / 200) || 0,
            speakingMin: Math.ceil(words.length / 130) || 0,
        };
    });

    // Lorem
    readonly loremMode = signal<LoremMode>('paragraphs');
    readonly loremCount = signal(3);
    readonly loremClassicStart = signal(true);
    readonly loremOutput = signal('');

    readonly copied = signal<string | null>(null);

    readonly caseButtons: { id: string; label: string }[] = [
        { id: 'upper', label: 'UPPERCASE' },
        { id: 'lower', label: 'lowercase' },
        { id: 'title', label: 'Title Case' },
        { id: 'sentence', label: 'Sentence case' },
        { id: 'camel', label: 'camelCase' },
        { id: 'pascal', label: 'PascalCase' },
        { id: 'snake', label: 'snake_case' },
        { id: 'kebab', label: 'kebab-case' },
        { id: 'constant', label: 'CONSTANT_CASE' },
        { id: 'alternating', label: 'aLtErNaTiNg' },
    ];

    ngOnInit(): void {
        this.seo.update({
            title: 'Text Utilities | Dev Tools',
            description:
                'Change text case, slugify strings, count words and characters, and generate lorem ipsum — all in one tool.',
            url: '/tools/text-utils',
            keywords: 'case converter, slugify, word counter, character count, lorem ipsum generator',
        });
    }

    setMode(m: Mode): void {
        if (this.mode() !== m) this.mode.set(m);
    }

    // --- Case ------------------------------------------------------------------

    applyCase(id: string): void {
        const input = this.caseInput();
        const words = this.splitWords(input);
        let out: string;
        switch (id) {
            case 'upper': out = input.toUpperCase(); break;
            case 'lower': out = input.toLowerCase(); break;
            case 'title':
                out = input.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
                break;
            case 'sentence':
                out = input.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (c) => c.toUpperCase());
                break;
            case 'camel':
                out = words.map((w, i) => (i === 0 ? w.toLowerCase() : this.cap(w))).join('');
                break;
            case 'pascal': out = words.map((w) => this.cap(w)).join(''); break;
            case 'snake': out = words.map((w) => w.toLowerCase()).join('_'); break;
            case 'kebab': out = words.map((w) => w.toLowerCase()).join('-'); break;
            case 'constant': out = words.map((w) => w.toUpperCase()).join('_'); break;
            case 'alternating':
                out = input.split('').map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase())).join('');
                break;
            default: out = input;
        }
        this.caseOutput.set(out);
        this.api.reportUsage({ toolId: 'text-utils', action: 'case', metadata: { variant: id } });
    }

    // --- Lorem -----------------------------------------------------------------

    generateLorem(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const count = Math.min(50, Math.max(1, Math.floor(Number(this.loremCount()) || 1)));
        const mode = this.loremMode();

        let out: string;
        if (mode === 'words') {
            out = this.loremWords(count, this.loremClassicStart());
        } else if (mode === 'sentences') {
            out = Array.from({ length: count }, (_, i) => this.loremSentence(i === 0 && this.loremClassicStart())).join(' ');
        } else {
            out = Array.from({ length: count }, (_, i) => {
                const sentences = 3 + Math.floor(Math.random() * 3);
                return Array.from({ length: sentences }, (_, j) => this.loremSentence(i === 0 && j === 0 && this.loremClassicStart())).join(' ');
            }).join('\n\n');
        }
        this.loremOutput.set(out);
        this.api.reportUsage({ toolId: 'text-utils', action: 'lorem', metadata: { mode, count } });
    }

    // --- Copy ------------------------------------------------------------------

    async copy(which: string, value: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || !value) return;
        if (await copyText(value)) {
            this.copied.set(which);
            setTimeout(() => this.copied.set(null), 1400);
            this.api.reportUsage({ toolId: 'text-utils', action: 'copy', metadata: { which } });
        }
    }

    // --- Internals ---------------------------------------------------------------

    private cap(w: string): string {
        return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    }

    /** Split on whitespace/underscore/hyphen plus camelCase boundaries. */
    private splitWords(input: string): string[] {
        return input
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .split(/[\s_\-]+/)
            .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
            .filter(Boolean);
    }

    private slugify(input: string): string {
        return input
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    private loremWords(count: number, classicStart: boolean): string {
        const out: string[] = [];
        for (let i = 0; i < count; i++) {
            if (classicStart && i < 5) {
                out.push(LOREM_WORDS[i]);
            } else {
                out.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
            }
        }
        return out.join(' ');
    }

    private loremSentence(classicStart: boolean): string {
        const len = 8 + Math.floor(Math.random() * 8);
        const words = this.loremWords(len, classicStart).split(' ');
        const sentence = words.join(' ');
        return sentence[0].toUpperCase() + sentence.slice(1) + '.';
    }
}
