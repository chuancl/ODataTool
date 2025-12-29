// 标准化 OData 响应数据 (兼容 V2 d.results 和 V4 value)
export const normalizeODataResponse = (data: any): any => {
    if (!data) return [];
    if (Array.isArray(data.value)) return data.value; // V4
    if (data.d) {
        if (Array.isArray(data.d.results)) return data.d.results; // V2
        if (Array.isArray(data.d)) return data.d;
        return data.d;
    }
    return data;
};

// 简单的 MIME 检测
export const detectImageMimeType = (b64: string): string | null => {
    if (b64.startsWith('/9j/')) return 'image/jpeg';
    if (b64.startsWith('iVBOR')) return 'image/png';
    if (b64.startsWith('R0lGOD')) return 'image/gif';
    if (b64.startsWith('Qk0')) return 'image/bmp';
    if (b64.startsWith('SUkq') || b64.startsWith('II*')) return 'image/tiff';
    if (b64.startsWith('UklGR')) return 'image/webp';
    return null; 
};

// Base64 清理工具 (包含 Northwind OLE Header 处理)
export const cleanBase64 = (b64: string): { src: string, isImage: boolean } => {
    // 1. 尝试检测标准头部
    let mime = detectImageMimeType(b64);
    if (mime) {
        return { src: `data:${mime};base64,${b64}`, isImage: true };
    }

    // 2. 尝试检测 Northwind 特有的 OLE Header (通常以 FRwv 开头)
    if (b64.startsWith('FRwv') || b64.length > 104) {
        // 尝试剥离前 104 个字符 (78 bytes)
        const stripped = b64.substring(104);
        mime = detectImageMimeType(stripped);
        if (mime) {
             return { src: `data:${mime};base64,${stripped}`, isImage: true };
        }
    }

    // 3. 如果都不是，但确实是二进制数据，可以尝试盲猜 BMP (legacy default)
    // 但为了不显示错误图片，这里返回原始 base64 但标记 isImage 为 false，交给 UI 决定是否强制渲染
    return { src: `data:image/bmp;base64,${b64}`, isImage: false };
};