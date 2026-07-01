import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// --- Minify ------------------------------------------------------------------
export type MinifyLanguage = 'html' | 'css' | 'js';

export interface MinifyRequest {
    language: MinifyLanguage;
    code: string;
    options?: Record<string, unknown>;
}

export interface MinifyResponse {
    output: string;
    bytesIn: number;
    bytesOut: number;
    savedBytes: number;
    savedPct: number;
    durationMs: number;
}

// --- CSS / SCSS --------------------------------------------------------------
export type CssDialect = 'css' | 'scss';

export interface TransformCssRequest {
    from: CssDialect;
    to: CssDialect;
    code: string;
    minify?: boolean;
    expanded?: boolean;
}

export interface TransformCssResponse {
    output: string;
    durationMs: number;
}

export interface ScssNestRequest {
    code: string;
    indent?: number;
}

export interface ScssNestResponse {
    output: string;
    durationMs: number;
}

// --- Images (multipart) ------------------------------------------------------
export interface ImageResult {
    /** Result image as a base64 data URL, ready for <img> + download. */
    output: string;
    format: string;
    bytesIn: number;
    bytesOut: number;
    savedBytes: number;
    savedPct: number;
    width: number;
    height: number;
    durationMs: number;
}

export interface PaletteColor {
    hex: string;
    r: number;
    g: number;
    b: number;
    population: number;
}

export interface ImagePaletteResponse {
    colors: PaletteColor[];
}

// --- Generators / codecs -----------------------------------------------------
export interface QrRequest {
    text: string;
    size?: number;
    margin?: number;
    dark?: string;
    light?: string;
    ecLevel?: 'L' | 'M' | 'Q' | 'H';
    format?: 'png' | 'svg';
}

export interface BarcodeRequest {
    text: string;
    type?: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
}

export interface GenImageResponse {
    /** data URL (png) or raw SVG markup depending on the request format. */
    output: string;
    format: string;
}

export interface JwtEncodeRequest {
    payload: Record<string, unknown> | string;
    secret: string;
    algorithm?: string;
    expiresIn?: string;
}

export interface JwtEncodeResponse {
    token: string;
}

export type HashAlgorithm = 'bcrypt' | 'md5' | 'sha1' | 'sha256' | 'sha512';

export interface PasswordHashRequest {
    password: string;
    algorithm: HashAlgorithm;
    rounds?: number;
}

export interface PasswordHashResponse {
    hash: string;
    algorithm: HashAlgorithm;
}

export type PaletteScheme =
    | 'analogous' | 'complementary' | 'triadic' | 'tetradic'
    | 'monochromatic' | 'shades' | 'tints';

export interface PaletteRequest {
    base: string;
    scheme: PaletteScheme;
    count?: number;
}

export interface PaletteResponse {
    colors: string[];
}

// --- Web extractors ----------------------------------------------------------
export interface ExtractResponse {
    colors: string[];
    fonts: string[];
    meta: { title?: string; description?: string; favicon?: string };
}

export interface SeoIssue {
    level: 'good' | 'warn' | 'error';
    msg: string;
}

export interface SeoResponse {
    url: string;
    title: string | null;
    titleLength: number;
    description: string | null;
    descriptionLength: number;
    canonical: string | null;
    robots: string | null;
    og: Record<string, string>;
    twitter: Record<string, string>;
    h1: string[];
    headings: { level: number; text: string }[];
    images: { total: number; missingAlt: number };
    issues: SeoIssue[];
}

/** HTTP client for the backend-backed dev tools (heavy / server-only tools). */
@Injectable({ providedIn: 'root' })
export class ToolsApiService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly base = `${environment.apiUrl}/tools`;

    // --- Code --------------------------------------------------------------
    minify(body: MinifyRequest): Observable<MinifyResponse> {
        return this.http.post<MinifyResponse>(`${this.base}/minify`, body);
    }

    transformCss(body: TransformCssRequest): Observable<TransformCssResponse> {
        return this.http.post<TransformCssResponse>(`${this.base}/transform-css`, body);
    }

    scssNest(body: ScssNestRequest): Observable<ScssNestResponse> {
        return this.http.post<ScssNestResponse>(`${this.base}/scss-nest`, body);
    }

    // --- Images (multipart/form-data) --------------------------------------
    compressImage(file: File, quality: number): Observable<ImageResult> {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('quality', String(quality));
        return this.http.post<ImageResult>(`${this.base}/image/compress`, fd);
    }

    convertImage(file: File, format: string, quality?: number): Observable<ImageResult> {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('format', format);
        if (quality != null) fd.append('quality', String(quality));
        return this.http.post<ImageResult>(`${this.base}/image/convert`, fd);
    }

    upscaleImage(file: File, scale: number): Observable<ImageResult> {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('scale', String(scale));
        return this.http.post<ImageResult>(`${this.base}/image/upscale`, fd);
    }

    imagePalette(file: File, count: number): Observable<ImagePaletteResponse> {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('count', String(count));
        return this.http.post<ImagePaletteResponse>(`${this.base}/image/palette`, fd);
    }

    faviconIco(file: File): Observable<ImageResult> {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<ImageResult>(`${this.base}/image/favicon`, fd);
    }

    // --- Generators / codecs ----------------------------------------------
    qr(body: QrRequest): Observable<GenImageResponse> {
        return this.http.post<GenImageResponse>(`${this.base}/qr`, body);
    }

    barcode(body: BarcodeRequest): Observable<GenImageResponse> {
        return this.http.post<GenImageResponse>(`${this.base}/barcode`, body);
    }

    jwtEncode(body: JwtEncodeRequest): Observable<JwtEncodeResponse> {
        return this.http.post<JwtEncodeResponse>(`${this.base}/jwt/encode`, body);
    }

    passwordHash(body: PasswordHashRequest): Observable<PasswordHashResponse> {
        return this.http.post<PasswordHashResponse>(`${this.base}/password/hash`, body);
    }

    palette(body: PaletteRequest): Observable<PaletteResponse> {
        return this.http.post<PaletteResponse>(`${this.base}/palette`, body);
    }

    // --- Web extractors ----------------------------------------------------
    extract(url: string): Observable<ExtractResponse> {
        return this.http.post<ExtractResponse>(`${this.base}/extract`, { url });
    }

    seo(url: string): Observable<SeoResponse> {
        return this.http.post<SeoResponse>(`${this.base}/seo`, { url });
    }

    // --- Telemetry ---------------------------------------------------------
    /** Fire-and-forget usage telemetry. Browser-only, never throws to the caller. */
    reportUsage(body: UsageRequest): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.http.post<{ ok: true }>(`${this.base}/usage`, body).subscribe({ error: () => { } });
    }
}

export interface UsageRequest {
    toolId: string;
    action?: string;
    metadata?: Record<string, unknown>;
}
