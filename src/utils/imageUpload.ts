/** Resize actual user-uploaded images before saving in the authenticated workspace JSON. */
export async function preparePhoto(file: File, maxEdge = 640): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('A imagem original deve ter até 8 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar esta imagem no dispositivo.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const output = canvas.toDataURL('image/webp', .72);
    if (!output.startsWith('data:image/webp;base64,')) throw new Error('O dispositivo não suporta conversão WebP.');
    if (output.length > 700_000) throw new Error('A imagem ficou grande demais. Escolha uma imagem menor.');
    return output;
  } finally { URL.revokeObjectURL(url); }
}
