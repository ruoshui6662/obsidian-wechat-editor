import type Token from 'markdown-it/lib/token.mjs';
export interface SourceRange { startLine: number; endLine: number }
export interface Diagnostic { code: string; message: string; severity: 'error'|'warning'; source?: SourceRange; occurrenceId?: string }
export interface ImageRef { occurrenceId: string; source: string; literalPath?: boolean; alt: string; blockKey: string; mode: 'inline'|'block'; width?: number; height?: number; range: SourceRange; markupRange?:{from:number;to:number} }
export interface ArticleBlock { key: string; blockId?: string; range: SourceRange; kind: string; tokens: Token[] }
export interface Article { title: string; sourcePath: string; source: string; revision: string; tokens: Token[]; blocks: ArticleBlock[]; images: ImageRef[]; diagnostics: Diagnostic[]; extractedTitle?: string }
export interface Account { id: string; name: string }
export const ARTICLE_THEME_IDS = ['daily','minimal','technology','serif-reading','warm'] as const;
export type ArticleThemeId = typeof ARTICLE_THEME_IDS[number];
export interface LayoutSettings { spacingMode:'smart'|'manual'; headingBefore:number; headingAfter:number; h3FontSize:number; h3AccentBar:boolean; themeId?:ArticleThemeId; fontFamily: 'system'|'sans'|'serif'|'source-han-serif'; fontSize: number; lineHeight: number; letterSpacing: number; paragraphBefore: number; paragraphAfter: number; firstLineIndent: number; sidePadding: number; textColor: string; textAlign: 'left'|'justify'; includeTitle: boolean }
export interface ImageStyle { backgroundMode?:'preserve'|'solid'; shadowOpacity?:number; shadowBlur?:number; shadowOffsetY?:number; leftInset?:number|null; rightInset?:number|null; widthPercent?: number|null; alignment: 'left'|'center'|'right'|'justify'; marginBefore: number; marginAfter: number; marginLeft:number; marginRight:number; radius: number; borderWidth: number; borderColor: string; shadow: number; background: string; bakeEffects: boolean }
export interface BlockOverride { text?: Partial<LayoutSettings>; image?: Partial<ImageStyle> }
export type BlockOverrides = Record<string, BlockOverride>;
export interface RenderedArticle { html: string; text: string; diagnostics: Diagnostic[] }
export interface ImageGeometry {naturalWidth:number; paddingRatio:number}
export interface PreparedAsset { geometry?:ImageGeometry; key: string; bytes: Uint8Array; mime: string; filename: string; occurrenceIds: string[] }
export class LayoutError extends Error { constructor(public code: string, message: string, public occurrenceIds: string[] = []) { super(message); this.name='LayoutError'; } }
