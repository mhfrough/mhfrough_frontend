import { Component, ElementRef, OnDestroy, OnInit, PLATFORM_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { downloadDataUrl, downloadBlob } from '../shared/clipboard.util';
import { ZipEntry, buildZip } from '../shared/zip.util';
import { SocialPostCardComponent } from './social-post-card.component';
import {
    PollOption,
    SOCIAL_PLATFORMS,
    SocialPlatform,
    SocialPostData,
    parseHashtags,
} from '../shared/social-post.util';

interface HistoryEntry {
    time: string;
    label: string;
}

const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;

@Component({
    selector: 'app-social-post',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent, SocialPostCardComponent],
    templateUrl: './social-post.component.html',
    styleUrl: './social-post.component.scss',
})
export class SocialPostComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    @ViewChild('previewGrid') previewGrid?: ElementRef<HTMLElement>;

    readonly platforms = SOCIAL_PLATFORMS;

    // --- Identity -----------------------------------------------------------------
    readonly displayName = signal('Your Name');
    readonly handle = signal('yourhandle');
    readonly timestamp = signal('2h');
    readonly avatarUrl = signal<string | null>(null);
    readonly avatarDragOver = signal(false);

    // --- Media --------------------------------------------------------------------
    readonly imageUrl = signal<string | null>(null);
    readonly imageDragOver = signal(false);

    // --- Content --------------------------------------------------------------------
    readonly caption = signal('');
    readonly tagInput = signal('');
    readonly hashtags = signal<string[]>([]);

    // --- Fake engagement -------------------------------------------------------------
    readonly likes = signal(128);
    readonly comments = signal(12);
    readonly shares = signal(4);

    // --- Poll ------------------------------------------------------------------------
    readonly pollEnabled = signal(false);
    readonly pollQuestion = signal('');
    readonly pollOptions = signal<PollOption[]>([
        { id: crypto.randomUUID(), text: '', votes: 0 },
        { id: crypto.randomUUID(), text: '', votes: 0 },
    ]);
    readonly canAddPollOption = computed(() => this.pollOptions().length < MAX_POLL_OPTIONS);
    readonly canRemovePollOption = computed(() => this.pollOptions().length > MIN_POLL_OPTIONS);

    // --- Platforms / export ------------------------------------------------------------
    readonly selectedPlatforms = signal<Set<SocialPlatform>>(new Set(SOCIAL_PLATFORMS.map((p) => p.id)));
    readonly exporting = signal(false);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly exportHistory = signal<HistoryEntry[]>([]);

    readonly selectedPlatformMetas = computed(() => this.platforms.filter((p) => this.selectedPlatforms().has(p.id)));

    readonly postData = computed<SocialPostData>(() => ({
        displayName: this.displayName() || 'Your Name',
        handle: this.handle() || 'yourhandle',
        avatarUrl: this.avatarUrl(),
        timestamp: this.timestamp() || 'now',
        imageUrl: this.imageUrl(),
        caption: this.caption(),
        hashtags: this.hashtags(),
        likes: this.likes(),
        comments: this.comments(),
        shares: this.shares(),
        pollEnabled: this.pollEnabled(),
        pollQuestion: this.pollQuestion(),
        pollOptions: this.pollOptions(),
    }));

    ngOnInit(): void {
        this.seo.update({
            title: 'Social Media Post Mockup Designer | Dev Tools',
            description:
                'Design a social post once — image, caption, hashtags and an optional poll — then preview exactly how it looks on Instagram, X, Facebook, LinkedIn and YouTube, and export as PNG, a ZIP, a PDF report or print it.',
            url: '/tools/social-post',
            keywords: 'social media post mockup, instagram post preview, twitter post preview, facebook post mockup, linkedin post mockup, social media preview generator',
        });
    }

    ngOnDestroy(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        if (this.avatarUrl()) URL.revokeObjectURL(this.avatarUrl()!);
        if (this.imageUrl()) URL.revokeObjectURL(this.imageUrl()!);
    }

    // --- Avatar upload --------------------------------------------------------------

    onAvatarInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.setAvatar(input.files?.[0] ?? null);
        input.value = '';
    }

    onAvatarDrop(event: DragEvent): void {
        event.preventDefault();
        this.avatarDragOver.set(false);
        this.setAvatar(event.dataTransfer?.files?.[0] ?? null);
    }

    onAvatarDragOver(event: DragEvent): void {
        event.preventDefault();
        this.avatarDragOver.set(true);
    }

    onAvatarDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.avatarDragOver.set(false);
    }

    private setAvatar(file: File | null): void {
        if (!file || !file.type.startsWith('image/') || !isPlatformBrowser(this.platformId)) return;
        if (this.avatarUrl()) URL.revokeObjectURL(this.avatarUrl()!);
        this.avatarUrl.set(URL.createObjectURL(file));
    }

    removeAvatar(): void {
        if (this.avatarUrl() && isPlatformBrowser(this.platformId)) URL.revokeObjectURL(this.avatarUrl()!);
        this.avatarUrl.set(null);
    }

    // --- Post image upload ------------------------------------------------------------

    onImageInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.setImage(input.files?.[0] ?? null);
        input.value = '';
    }

    onImageDrop(event: DragEvent): void {
        event.preventDefault();
        this.imageDragOver.set(false);
        this.setImage(event.dataTransfer?.files?.[0] ?? null);
    }

    onImageDragOver(event: DragEvent): void {
        event.preventDefault();
        this.imageDragOver.set(true);
    }

    onImageDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.imageDragOver.set(false);
    }

    private setImage(file: File | null): void {
        if (!file || !file.type.startsWith('image/') || !isPlatformBrowser(this.platformId)) return;
        if (this.imageUrl()) URL.revokeObjectURL(this.imageUrl()!);
        this.imageUrl.set(URL.createObjectURL(file));
    }

    removeImage(): void {
        if (this.imageUrl() && isPlatformBrowser(this.platformId)) URL.revokeObjectURL(this.imageUrl()!);
        this.imageUrl.set(null);
    }

    // --- Hashtags -----------------------------------------------------------------

    commitTagInput(): void {
        const parsed = parseHashtags(this.tagInput());
        if (!parsed.length) return;
        this.hashtags.update((list) => [...list, ...parsed.filter((t) => !list.includes(t))]);
        this.tagInput.set('');
    }

    onTagKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            this.commitTagInput();
        }
    }

    removeTag(tag: string): void {
        this.hashtags.update((list) => list.filter((t) => t !== tag));
    }

    // --- Poll -----------------------------------------------------------------------

    togglePoll(enabled: boolean): void {
        this.pollEnabled.set(enabled);
    }

    addPollOption(): void {
        if (!this.canAddPollOption()) return;
        this.pollOptions.update((list) => [...list, { id: crypto.randomUUID(), text: '', votes: 0 }]);
    }

    removePollOption(id: string): void {
        if (!this.canRemovePollOption()) return;
        this.pollOptions.update((list) => list.filter((o) => o.id !== id));
    }

    setPollOptionText(id: string, text: string): void {
        this.pollOptions.update((list) => list.map((o) => (o.id === id ? { ...o, text } : o)));
    }

    setPollOptionVotes(id: string, votes: string): void {
        const n = Math.max(0, Math.round(Number(votes)) || 0);
        this.pollOptions.update((list) => list.map((o) => (o.id === id ? { ...o, votes: n } : o)));
    }

    // --- Platform selection -----------------------------------------------------------

    togglePlatform(id: SocialPlatform): void {
        this.selectedPlatforms.update((set) => {
            const next = new Set(set);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    isPlatformSelected(id: SocialPlatform): boolean {
        return this.selectedPlatforms().has(id);
    }

    // --- Export -----------------------------------------------------------------------

    private cardElement(platform: SocialPlatform): HTMLElement | null {
        return this.previewGrid?.nativeElement.querySelector<HTMLElement>(`[data-platform="${platform}"] app-social-post-card`) ?? null;
    }

    private async renderCanvas(el: HTMLElement) {
        const { default: html2canvas } = await import('html2canvas');
        return html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    }

    async downloadPng(platform: SocialPlatform): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || this.exporting()) return;
        const el = this.cardElement(platform);
        if (!el) return;
        this.exporting.set(true);
        this.error.set(null);
        try {
            const canvas = await this.renderCanvas(el);
            downloadDataUrl(canvas.toDataURL('image/png'), `social-post-${platform}.png`);
            this.pushHistory(`Downloaded ${platform} PNG`);
            this.api.reportUsage({ toolId: 'social-post', action: `download-png-${platform}` });
        } catch {
            this.error.set('Could not render that mockup to an image. Try again.');
        } finally {
            this.exporting.set(false);
        }
    }

    async downloadZip(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || this.exporting() || !this.selectedPlatformMetas().length) return;
        this.exporting.set(true);
        this.error.set(null);
        try {
            const entries: ZipEntry[] = [];
            for (const meta of this.selectedPlatformMetas()) {
                const el = this.cardElement(meta.id);
                if (!el) continue;
                const canvas = await this.renderCanvas(el);
                const blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png');
                });
                entries.push({ path: `social-post-${meta.id}.png`, data: blob });
            }
            if (!entries.length) throw new Error('Nothing to export.');
            const zip = await buildZip(entries);
            downloadBlob(zip, 'social-post-mockups.zip');
            this.pushHistory(`Downloaded ${entries.length} mockup(s) as ZIP`);
            this.api.reportUsage({ toolId: 'social-post', action: 'download-zip', metadata: { count: entries.length } });
        } catch {
            this.error.set('Could not build the ZIP. Try again.');
        } finally {
            this.exporting.set(false);
        }
    }

    async downloadPdf(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || this.exporting() || !this.selectedPlatformMetas().length) return;
        this.exporting.set(true);
        this.error.set(null);
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const margin = 40;

            doc.setFontSize(18);
            doc.setTextColor(20);
            doc.text('Social Post Preview Report', margin, 50);
            doc.setFontSize(9);
            doc.setTextColor(120);
            doc.text(`Generated ${new Date().toLocaleString()}`, margin, 66);
            if (this.caption()) {
                const captionLines = doc.splitTextToSize(this.caption(), pageW - margin * 2);
                doc.setFontSize(10);
                doc.setTextColor(60);
                doc.text(captionLines, margin, 84);
            }

            let y = 110;
            let rendered = 0;
            for (const meta of this.selectedPlatformMetas()) {
                const el = this.cardElement(meta.id);
                if (!el) continue;
                const canvas = await this.renderCanvas(el);
                const imgData = canvas.toDataURL('image/png');
                const imgW = Math.min(pageW - margin * 2, 260);
                const imgH = (canvas.height / canvas.width) * imgW;

                if (y + imgH + 30 > pageH - margin) {
                    doc.addPage();
                    y = margin;
                }

                doc.setFontSize(13);
                doc.setTextColor(20);
                doc.text(meta.label, margin, y);
                doc.addImage(imgData, 'PNG', margin, y + 10, imgW, imgH);
                y += imgH + 40;
                rendered++;
            }

            if (!rendered) throw new Error('Nothing to export.');
            doc.save('social-post-report.pdf');
            this.pushHistory(`Downloaded a ${rendered}-mockup PDF report`);
            this.api.reportUsage({ toolId: 'social-post', action: 'download-pdf', metadata: { count: rendered } });
        } catch {
            this.error.set('Could not build the PDF report. Try again.');
        } finally {
            this.exporting.set(false);
        }
    }

    print(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.api.reportUsage({ toolId: 'social-post', action: 'print' });
        window.print();
    }

    private pushHistory(label: string): void {
        this.exportHistory.update((list) => [{ time: new Date().toLocaleTimeString(), label }, ...list].slice(0, 8));
    }
}
