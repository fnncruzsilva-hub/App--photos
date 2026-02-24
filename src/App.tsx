import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  Plus, 
  Minus, 
  FileText, 
  Settings2, 
  Layout, 
  Download,
  AlertCircle,
  CheckCircle2,
  Printer,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { 
  STANDARD_SIZES, 
  A4_WIDTH_CM, 
  A4_HEIGHT_CM, 
  type ImageFile, 
  type PrintSettings, 
  type PhotoSize 
} from './types';
import { cn } from './lib/utils';

export default function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [settings, setSettings] = useState<PrintSettings>({
    sizeId: '10x15',
    customWidth: 10,
    customHeight: 15,
    customUnit: 'cm',
    hasBorder: false,
    isPolaroid: false,
    orientation: 'auto',
    spacing: 0.2,
    margin: 0.3,
    fitMode: 'cover',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingImages, setIsSavingImages] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files) as File[];
    const newImages: ImageFile[] = fileList.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      copies: 1,
      width: 0,
      height: 0
    }));

    // Get dimensions
    newImages.forEach(img => {
      const i = new Image();
      i.onload = () => {
        setImages(prev => prev.map(p => p.id === img.id ? { ...p, width: i.width, height: i.height } : p));
      };
      i.src = img.previewUrl;
    });

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const updateCopies = (id: string, delta: number) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, copies: Math.max(1, img.copies + delta) } : img
    ));
  };

  const getTargetSize = (): { width: number, height: number } => {
    if (settings.sizeId === 'custom') {
      let w = settings.customWidth;
      let h = settings.customHeight;
      if (settings.customUnit === 'inch') {
        w *= 2.54;
        h *= 2.54;
      } else if (settings.customUnit === 'px') {
        w = (w * 2.54) / 300;
        h = (h * 2.54) / 300;
      }
      return { width: w, height: h };
    }
    const size = STANDARD_SIZES.find(s => s.id === settings.sizeId);
    return { width: size?.widthCm || 10, height: size?.heightCm || 15 };
  };

  // Layout calculation
  const calculateLayout = () => {
    const targetSize = getTargetSize();
    const pages: { images: { img: ImageFile, x: number, y: number, w: number, h: number, isRotated: boolean }[] }[] = [];
    let currentImages: { img: ImageFile, x: number, y: number, w: number, h: number, isRotated: boolean }[] = [];

    const margin = settings.margin;
    const spacing = settings.spacing;
    const pageWidth = A4_WIDTH_CM;
    const pageHeight = A4_HEIGHT_CM;

    let currentX = margin;
    let currentY = margin;
    let rowHeight = 0;

    const allItemsToPrint: ImageFile[] = [];
    images.forEach(img => {
      for (let i = 0; i < img.copies; i++) {
        allItemsToPrint.push(img);
      }
    });

    allItemsToPrint.forEach(img => {
      let w = targetSize.width;
      let h = targetSize.height;
      let isRotated = false;

      // Auto orientation
      if (settings.orientation === 'auto') {
        const imgIsLandscape = img.width > img.height;
        const targetIsLandscape = w > h;
        if (imgIsLandscape !== targetIsLandscape) {
          [w, h] = [h, w];
          isRotated = true;
        }
      } else if (settings.orientation === 'landscape') {
        if (w < h) {
          [w, h] = [h, w];
          isRotated = true;
        }
      } else if (settings.orientation === 'portrait') {
        if (w > h) {
          [w, h] = [h, w];
          isRotated = true;
        }
      }

      // Check if it fits in current row
      if (currentX + w > pageWidth - margin + 0.001) {
        currentX = margin;
        currentY += rowHeight + spacing;
        rowHeight = 0;
      }

      // Check if it fits in current page
      if (currentY + h > pageHeight - margin + 0.001) {
        pages.push({ images: currentImages });
        currentImages = [];
        currentX = margin;
        currentY = margin;
        rowHeight = 0;
      }

      currentImages.push({ img, x: currentX, y: currentY, w, h, isRotated });
      currentX += w + spacing;
      rowHeight = Math.max(rowHeight, h);
    });

    if (currentImages.length > 0) {
      pages.push({ images: currentImages });
    }

    // Center the images horizontally on each page
    pages.forEach(page => {
      if (page.images.length === 0) return;

      const minX = Math.min(...page.images.map(i => i.x));
      const maxX = Math.max(...page.images.map(i => i.x + i.w));

      const contentWidth = maxX - minX;
      const offsetX = (pageWidth - contentWidth) / 2 - minX;

      page.images.forEach(img => {
        img.x += offsetX;
      });
    });

    return pages;
  };

  const pages = calculateLayout();

  // Reset preview page if out of bounds
  useEffect(() => {
    if (previewPage >= pages.length && pages.length > 0) {
      setPreviewPage(pages.length - 1);
    } else if (pages.length === 0) {
      setPreviewPage(0);
    }
  }, [pages.length, previewPage]);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'cm',
        format: 'a4'
      });

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const page = pages[i];
        for (const item of page.images) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          const imgElement = await new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = item.img.previewUrl;
          });

          // Determine if we should rotate the image to fit the slot better
          const slotAspect = item.w / item.h;
          const imgAspect = imgElement.width / imgElement.height;
          const shouldRotate = (slotAspect > 1 && imgAspect < 1) || (slotAspect < 1 && imgAspect > 1);

          // Set high resolution (300 DPI = ~118.11 pixels per cm)
          const scale = 118.11; 
          canvas.width = Math.round(item.w * scale);
          canvas.height = Math.round(item.h * scale);
          
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          let drawW = canvas.width;
          let drawH = canvas.height;
          let drawX = 0;
          let drawY = 0;

          if (settings.hasBorder || settings.isPolaroid) {
            const borderSize = canvas.width * 0.04;
            const bottomExtra = settings.isPolaroid ? canvas.height * 0.12 : 0;
            
            drawX = borderSize;
            drawY = borderSize;
            drawW = canvas.width - borderSize * 2;
            drawH = canvas.height - borderSize * 2 - bottomExtra;
          }

          ctx.save();
          
          if (shouldRotate) {
            ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-(drawX + drawW / 2), -(drawY + drawH / 2));
            
            // Swap draw dimensions for the image drawing logic
            const temp = drawW;
            drawW = drawH;
            drawH = temp;
          }

          // Calculate crop for the (possibly rotated) image
          const currentImgAspect = shouldRotate ? imgElement.height / imgElement.width : imgElement.width / imgElement.height;
          const targetAspect = drawW / drawH;
          
          if (settings.fitMode === 'cover') {
            let sourceX = 0, sourceY = 0, sourceW = imgElement.width, sourceH = imgElement.height;
            
            if (currentImgAspect > targetAspect) {
              // Image is wider than target - crop sides (center)
              sourceW = imgElement.height * targetAspect;
              sourceX = (imgElement.width - sourceW) / 2;
            } else {
              // Image is taller than target - crop top/bottom
              sourceH = imgElement.width / targetAspect;
              // Smart Bias: keep more of the top (35% from top, 65% from bottom)
              // This favors faces in portrait shots
              sourceY = (imgElement.height - sourceH) * 0.35;
            }
            ctx.drawImage(imgElement, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
          } else {
            // Contain mode: show the whole image
            let finalDrawW = drawW;
            let finalDrawH = drawH;
            let finalDrawX = drawX;
            let finalDrawY = drawY;

            if (currentImgAspect > targetAspect) {
              // Image is wider than target - scale to width, center vertically
              finalDrawH = drawW / currentImgAspect;
              finalDrawY = drawY + (drawH - finalDrawH) / 2;
            } else {
              // Image is taller than target - scale to height, center horizontally
              finalDrawW = drawH * currentImgAspect;
              finalDrawX = drawX + (drawW - finalDrawW) / 2;
            }
            ctx.drawImage(imgElement, finalDrawX, finalDrawY, finalDrawW, finalDrawH);
          }
          ctx.restore();

          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          pdf.addImage(imgData, 'JPEG', item.x, item.y, item.w, item.h, undefined, 'FAST');
        }
      }

      pdf.save(`impressao-${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToPNG = async () => {
    if (images.length === 0) return;
    setIsSavingImages(true);
    
    try {
      const targetSize = getTargetSize();
      const dpi = 300;
      const pxW = Math.round((targetSize.width / 2.54) * dpi);
      const pxH = Math.round((targetSize.height / 2.54) * dpi);

      for (const img of images) {
        for (let c = 0; c < img.copies; c++) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // Determine orientation
          let finalW = pxW;
          let finalH = pxH;
          const isImgLandscape = img.width > img.height;
          
          if (settings.orientation === 'landscape' || (settings.orientation === 'auto' && isImgLandscape)) {
            if (finalW < finalH) [finalW, finalH] = [finalH, finalW];
          } else if (settings.orientation === 'portrait' || (settings.orientation === 'auto' && !isImgLandscape)) {
            if (finalW > finalH) [finalW, finalH] = [finalH, finalW];
          }

          canvas.width = finalW;
          canvas.height = finalH;

          // Fill background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, finalW, finalH);

          const imgElement = await new Promise<HTMLImageElement>((resolve) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.src = img.previewUrl;
          });

          // Determine if we should rotate the image to fit the slot better
          const slotAspect = finalW / finalH;
          const imgAspect = imgElement.width / imgElement.height;
          const shouldRotate = (slotAspect > 1 && imgAspect < 1) || (slotAspect < 1 && imgAspect > 1);

          let drawX = 0, drawY = 0, drawW = finalW, drawH = finalH;
          let borderSize = 0;
          let bottomExtra = 0;

          if (settings.hasBorder || settings.isPolaroid) {
            borderSize = Math.round(finalW * 0.04);
            if (settings.isPolaroid) {
              bottomExtra = Math.round(finalH * 0.12);
            }
            drawX = borderSize;
            drawY = borderSize;
            drawW = finalW - borderSize * 2;
            drawH = finalH - borderSize * 2 - bottomExtra;
          }

          ctx.save();
          if (shouldRotate) {
            ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
            ctx.rotate(Math.PI / 2);
            ctx.translate(-(drawX + drawW / 2), -(drawY + drawH / 2));
            
            const temp = drawW;
            drawW = drawH;
            drawH = temp;
          }

          // Draw image with improved logic
          const currentImgAspect = shouldRotate ? imgElement.height / imgElement.width : imgElement.width / imgElement.height;
          const targetAspect = drawW / drawH;

          if (settings.fitMode === 'cover') {
            let sourceX = 0, sourceY = 0, sourceW = imgElement.width, sourceH = imgElement.height;
            
            if (currentImgAspect > targetAspect) {
              // Image is wider than target - crop sides (center)
              sourceW = imgElement.height * targetAspect;
              sourceX = (imgElement.width - sourceW) / 2;
            } else {
              // Image is taller than target - crop top/bottom
              sourceH = imgElement.width / targetAspect;
              // Smart Bias: keep more of the top (35% from top, 65% from bottom)
              sourceY = (imgElement.height - sourceH) * 0.35;
            }
            ctx.drawImage(imgElement, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
          } else {
            // Contain mode: show the whole image
            let finalDrawW = drawW;
            let finalDrawH = drawH;
            let finalDrawX = drawX;
            let finalDrawY = drawY;

            if (currentImgAspect > targetAspect) {
              // Image is wider than target - scale to width, center vertically
              finalDrawH = drawW / currentImgAspect;
              finalDrawY = drawY + (drawH - finalDrawH) / 2;
            } else {
              // Image is taller than target - scale to height, center horizontally
              finalDrawW = drawH * currentImgAspect;
              finalDrawX = drawX + (drawW - finalDrawW) / 2;
            }
            ctx.drawImage(imgElement, finalDrawX, finalDrawY, finalDrawW, finalDrawH);
          }
          ctx.restore();

          // Download
          const link = document.createElement('a');
          link.download = `foto-${img.file.name.split('.')[0]}-${c + 1}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          
          // Small delay to avoid browser blocking multiple downloads
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (error) {
      console.error('Error saving images:', error);
    } finally {
      setIsSavingImages(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#1A1A1A] font-sans selection:bg-black selection:text-white pb-24 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-black/5 px-6 py-4 md:px-8 md:py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-black rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/10">
              <Printer size={22} className="md:hidden" strokeWidth={1.5} />
              <Printer size={26} className="hidden md:block" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-serif italic tracking-tight text-black">PhotoPrint A4</h1>
              <p className="text-[8px] md:text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">PRO</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={saveToPNG}
              disabled={images.length === 0 || isSavingImages}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-black rounded-full text-xs font-bold hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-30 shadow-sm border border-black/5"
            >
              {isSavingImages ? (
                <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <ImageIcon size={14} strokeWidth={2.5} />
              )}
              <span className="hidden sm:inline">Salvar no arquivo</span>
              <span className="sm:hidden">PNG</span>
            </button>
            <button 
              onClick={generatePDF}
              disabled={images.length === 0 || isGenerating}
              className="flex items-center gap-2 md:gap-3 px-5 py-2.5 md:px-8 md:py-3 bg-black text-white rounded-full text-xs md:text-sm font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-black/20"
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download size={16} className="md:hidden" strokeWidth={2.5} />
              )}
              <Download size={18} className="hidden md:block" strokeWidth={2.5} />
              <span className="hidden sm:inline">Gerar PDF</span>
              <span className="sm:hidden text-[10px]">PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Navigation removed */}

      {/* Floating Add Button */}
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-50 w-14 h-14 md:w-16 md:h-16 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group"
      >
        <Plus size={28} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
        <div className="absolute -top-12 right-0 bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap uppercase tracking-widest">
          Adicionar Fotos
        </div>
      </button>

      <main className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="space-y-8 lg:space-y-10">
          {/* Controls Section */}
          <div className="space-y-8">
            {/* Gallery Section */}
            <section className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-300">01. Galeria</h2>
                <span className="text-[10px] font-mono bg-zinc-100 px-3 py-1 rounded-full text-zinc-500 font-bold">
                  {images.length} ARQUIVOS
                </span>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                multiple 
                accept="image/*" 
                className="hidden" 
              />
              
              {images.length === 0 ? (
                <div className="text-center py-12 px-6 border-2 border-dashed border-zinc-100 rounded-[1.5rem] bg-zinc-50/50">
                  <div className="w-16 h-16 rounded-full bg-white mx-auto flex items-center justify-center shadow-sm mb-4">
                    <ImageIcon className="text-zinc-200" size={28} />
                  </div>
                  <p className="text-sm font-bold text-black">Sua galeria está vazia</p>
                  <p className="text-xs text-zinc-400 mt-1">Use o botão flutuante para adicionar fotos</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {images.map((img) => (
                      <motion.div 
                        key={img.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-black/[0.03] group hover:bg-white hover:shadow-md transition-all"
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-sm">
                          <img src={img.previewUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-black truncate">{img.file.name}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center bg-white rounded-lg border border-black/5 p-1">
                              <button 
                                onClick={() => updateCopies(img.id, -1)}
                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400"
                              >
                                <Minus size={12} strokeWidth={3} />
                              </button>
                              <span className="text-xs font-black w-6 text-center">{img.copies}</span>
                              <button 
                                onClick={() => updateCopies(img.id, 1)}
                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400"
                              >
                                <Plus size={12} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeImage(img.id)}
                          className="p-2.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} strokeWidth={1.5} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Orientation Section */}
            <section className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-black/5 space-y-6">
              <h2 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-300">02. Orientação</h2>
              <div className="flex gap-2">
                {['auto', 'portrait', 'landscape'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSettings(prev => ({ ...prev, orientation: opt as any }))}
                    className={cn(
                      "flex-1 py-3 text-[10px] font-bold uppercase rounded-xl border transition-all",
                      settings.orientation === opt ? "bg-black text-white border-black shadow-lg shadow-black/10" : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-300"
                    )}
                  >
                    {opt === 'auto' ? 'Auto' : opt === 'portrait' ? 'Retrato' : 'Paisagem'}
                  </button>
                ))}
              </div>
            </section>

            {/* Settings Section */}
            <section className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-black/5 space-y-8">
              <h2 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-300">03. Ajustes</h2>
              
              {/* Size Selector */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Layout size={14} strokeWidth={2.5} /> Dimensões
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {STANDARD_SIZES.map(size => (
                    <button
                      key={size.id}
                      onClick={() => setSettings(prev => ({ ...prev, sizeId: size.id }))}
                      className={cn(
                        "px-4 py-3 text-[11px] font-bold rounded-xl border transition-all",
                        settings.sizeId === size.id 
                          ? "bg-black text-white border-black shadow-lg shadow-black/10" 
                          : "bg-white text-zinc-500 border-zinc-100 hover:border-zinc-300"
                      )}
                    >
                      {size.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, sizeId: 'custom' }))}
                    className={cn(
                      "px-4 py-3 text-[11px] font-bold rounded-xl border transition-all",
                      settings.sizeId === 'custom' 
                        ? "bg-black text-white border-black shadow-lg shadow-black/10" 
                        : "bg-white text-zinc-500 border-zinc-100 hover:border-zinc-300"
                    )}
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              {/* Custom Size Inputs */}
              {settings.sizeId === 'custom' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 bg-zinc-50 rounded-2xl border border-black/5 space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Largura</label>
                      <input 
                        type="number" 
                        value={settings.customWidth}
                        onChange={(e) => setSettings(prev => ({ ...prev, customWidth: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Altura</label>
                      <input 
                        type="number" 
                        value={settings.customHeight}
                        onChange={(e) => setSettings(prev => ({ ...prev, customHeight: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {['cm', 'inch', 'px'].map(unit => (
                      <button
                        key={unit}
                        onClick={() => setSettings(prev => ({ ...prev, customUnit: unit as any }))}
                        className={cn(
                          "flex-1 py-1 text-[10px] font-bold uppercase rounded-md border transition-all",
                          settings.customUnit === unit ? "bg-black text-white border-black" : "bg-white text-zinc-400 border-zinc-200"
                        )}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Layout Options */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Layout size={14} strokeWidth={2.5} /> Estilo e Layout
                </label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Borda Branca</span>
                    <button 
                      onClick={() => setSettings(prev => ({ ...prev, hasBorder: !prev.hasBorder }))}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        settings.hasBorder ? "bg-black" : "bg-zinc-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                        settings.hasBorder ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Estilo Polaroid</span>
                    <button 
                      onClick={() => setSettings(prev => ({ ...prev, isPolaroid: !prev.isPolaroid }))}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        settings.isPolaroid ? "bg-black" : "bg-zinc-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                        settings.isPolaroid ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Modo de Recorte</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, fitMode: 'cover' }))}
                        className={cn(
                          "px-3 py-2 text-[10px] font-bold rounded-lg border transition-all",
                          settings.fitMode === 'cover' ? "bg-black text-white border-black" : "bg-zinc-50 text-zinc-400 border-zinc-100"
                        )}
                      >
                        Preencher (Foco no Centro/Rosto)
                      </button>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, fitMode: 'contain' }))}
                        className={cn(
                          "px-3 py-2 text-[10px] font-bold rounded-lg border transition-all",
                          settings.fitMode === 'contain' ? "bg-black text-white border-black" : "bg-zinc-50 text-zinc-400 border-zinc-100"
                        )}
                      >
                        Inteira (Sem Cortes)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Margem (cm)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={settings.margin}
                        onChange={(e) => setSettings(prev => ({ ...prev, margin: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Espaço (cm)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={settings.spacing}
                        onChange={(e) => setSettings(prev => ({ ...prev, spacing: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-6 py-8 md:py-12 text-center space-y-4">
        <p className="text-[10px] md:text-xs text-zinc-400 font-medium">
          PhotoPrint A4 © 2026 • Impressão PRO
        </p>
      </footer>
    </div>
  );
}
