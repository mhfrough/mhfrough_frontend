import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-tag-input',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './tag-input.component.html',
})
export class TagInputComponent {
    @Input() tags: string[] = [];
    @Output() tagsChange = new EventEmitter<string[]>();
    @Input() suggestions: string[] = [];

    @ViewChild('tagInput') tagInputRef!: ElementRef<HTMLInputElement>;

    inputValue = '';
    showDropdown = false;

    get filteredSuggestions(): string[] {
        if (!this.showDropdown) return [];
        const q = this.inputValue.toLowerCase().trim();
        const existing = new Set(this.tags);
        if (!q) return this.suggestions.filter(s => !existing.has(s)).slice(0, 8);
        return this.suggestions
            .filter(s => s.toLowerCase().includes(q) && !existing.has(s))
            .slice(0, 8);
    }

    private slugify(val: string): string {
        return val
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-');
    }

    addTag(raw: string) {
        const tag = this.slugify(raw.replace(',', '').trim());
        if (!tag || this.tags.includes(tag)) {
            this.inputValue = '';
            return;
        }
        this.tagsChange.emit([...this.tags, tag]);
        this.inputValue = '';
        this.showDropdown = false;
    }

    removeTag(tag: string) {
        this.tagsChange.emit(this.tags.filter(t => t !== tag));
    }

    onKeyDown(e: KeyboardEvent) {
        if ((e.key === 'Enter' || e.key === ',') && this.inputValue.trim()) {
            e.preventDefault();
            this.addTag(this.inputValue);
        } else if (e.key === 'Backspace' && !this.inputValue && this.tags.length > 0) {
            this.tagsChange.emit(this.tags.slice(0, -1));
        } else if (e.key === 'Escape') {
            this.showDropdown = false;
        }
    }

    onInput() {
        this.showDropdown = true;
    }

    onFocus() {
        this.showDropdown = true;
    }

    onBlur() {
        setTimeout(() => {
            this.showDropdown = false;
            if (this.inputValue.trim()) this.addTag(this.inputValue);
        }, 150);
    }

    focusInput() {
        this.tagInputRef?.nativeElement.focus();
    }
}
