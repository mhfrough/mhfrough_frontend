import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ColorSwatch {
    name: string;
    variable: string;
    hex: string;
    textColor: string;
}

interface TypeScale {
    label: string;
    size: string;
    weight: string;
    lineHeight: string;
    sample: string;
}

interface SpacingToken {
    name: string;
    value: string;
    px: number;
}

@Component({
    selector: 'app-brand',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './brand.component.html',
})
export class BrandComponent {
    readonly lightColors: ColorSwatch[] = [
        { name: 'Background', variable: '--bg', hex: '#edebe7', textColor: '#2e2c29' },
        { name: 'Text', variable: '--text', hex: '#2e2c29', textColor: '#edebe7' },
        { name: 'Text Muted', variable: '--text-muted', hex: '#918e87', textColor: '#edebe7' },
        { name: 'Accent', variable: '--accent', hex: '#2e2c29', textColor: '#edebe7' },
        { name: 'Paper', variable: '--paper', hex: '#edebe7', textColor: '#2e2c29' },
        { name: 'Indigo', variable: '--indigo', hex: '#6366f1', textColor: '#ffffff' },
    ];

    readonly darkColors: ColorSwatch[] = [
        { name: 'Background', variable: '--bg', hex: '#1a1917', textColor: '#e4e0d8' },
        { name: 'Text', variable: '--text', hex: '#e4e0d8', textColor: '#1a1917' },
        { name: 'Text Muted', variable: '--text-muted', hex: '#7a7770', textColor: '#e4e0d8' },
        { name: 'Accent', variable: '--accent', hex: '#e4e0d8', textColor: '#1a1917' },
        { name: 'Paper', variable: '--paper', hex: '#1a1917', textColor: '#e4e0d8' },
        { name: 'Indigo', variable: '--indigo', hex: '#6366f1', textColor: '#ffffff' },
    ];

    readonly typeScale: TypeScale[] = [
        { label: 'Display', size: '3.5rem', weight: '700', lineHeight: '1.1', sample: 'The quick brown fox' },
        { label: 'H1', size: '2.5rem', weight: '700', lineHeight: '1.2', sample: 'The quick brown fox' },
        { label: 'H2', size: '2rem', weight: '600', lineHeight: '1.25', sample: 'The quick brown fox' },
        { label: 'H3', size: '1.5rem', weight: '600', lineHeight: '1.3', sample: 'The quick brown fox' },
        { label: 'H4', size: '1.25rem', weight: '500', lineHeight: '1.35', sample: 'The quick brown fox' },
        { label: 'Body', size: '1rem', weight: '400', lineHeight: '1.6', sample: 'The quick brown fox jumps over the lazy dog. Typography is the craft of enduring.' },
        { label: 'Small', size: '0.875rem', weight: '400', lineHeight: '1.5', sample: 'The quick brown fox jumps over the lazy dog.' },
        { label: 'Caption', size: '0.75rem', weight: '500', lineHeight: '1.4', sample: 'Caption text — labels, metadata, timestamps.' },
    ];

    readonly fontWeights = [
        { label: 'Light', value: 300 },
        { label: 'Regular', value: 400 },
        { label: 'Medium', value: 500 },
        { label: 'SemiBold', value: 600 },
        { label: 'Bold', value: 700 },
    ];

    readonly spacingTokens: SpacingToken[] = [
        { name: 'space-1', value: '0.25rem', px: 4 },
        { name: 'space-2', value: '0.5rem', px: 8 },
        { name: 'space-3', value: '0.75rem', px: 12 },
        { name: 'space-4', value: '1rem', px: 16 },
        { name: 'space-5', value: '1.5rem', px: 24 },
        { name: 'space-6', value: '2rem', px: 32 },
        { name: 'space-7', value: '3rem', px: 48 },
        { name: 'space-8', value: '4rem', px: 64 },
        { name: 'space-9', value: '6rem', px: 96 },
    ];

    readonly borderRadii = [
        { name: 'sm', value: '4px' },
        { name: 'md', value: '8px' },
        { name: 'lg', value: '12px' },
        { name: 'xl', value: '16px' },
        { name: 'pill', value: '9999px' },
    ];

    readonly shadows = [
        { name: 'xs', value: '0 1px 2px rgba(0,0,0,0.06)' },
        { name: 'sm', value: '0 2px 8px rgba(0,0,0,0.08)' },
        { name: 'md', value: '0 4px 16px rgba(0,0,0,0.10)' },
        { name: 'lg', value: '0 8px 32px rgba(0,0,0,0.12)' },
    ];

    copied = '';

    copy(text: string): void {
        navigator.clipboard.writeText(text).then(() => {
            this.copied = text;
            setTimeout(() => { this.copied = ''; }, 1500);
        });
    }
}
