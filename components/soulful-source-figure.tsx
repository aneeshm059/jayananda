'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand, Minus, Plus, X } from 'lucide-react';
import type { SoulfulBlock } from '@/lib/domain/soulful-reading';
import { soulfulImageTransform } from '@/lib/domain/soulful-presentation';
import { respectfulAuthor } from '@/lib/domain/display-names';

export function SoulfulSourceFigure({ block, index }: { block: SoulfulBlock; index: number }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <figure data-source-page={block.page} id={'source-block-' + index}>
      <button
        ref={trigger}
        type="button"
        className="soulful-image-open"
        aria-label={`View illustration from page ${block.page} full screen`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <img
          src={block.src}
          alt={block.alt || `Illustration from source page ${block.page}`}
          width={block.width}
          height={block.height}
          loading="lazy"
          style={{ transform: soulfulImageTransform(block.src) }}
        />
        <span>
          <Expand size={15} /> View full screen
        </span>
      </button>
      {block.text && <figcaption>{respectfulAuthor(block.text)}</figcaption>}
      {open &&
        createPortal(
          <ImageViewer
            block={block}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus({ preventScroll: true });
            }}
          />,
          document.body,
        )}
    </figure>
  );
}

function ImageViewer({ block, onClose }: { block: SoulfulBlock; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(viewport.current!);
    return () => {
      observer.disconnect();
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const width = block.width || 800;
  const height = block.height || 600;
  const fit = Math.min(size.width / width, size.height / height);
  return (
    <dialog
      ref={dialog}
      className="soulful-image-viewer"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="soulful-image-toolbar">
        <span id={titleId}>Illustration · page {block.page}</span>
        <div role="group" aria-label="Image zoom">
          <button
            className="icon-button"
            aria-label="Zoom out"
            disabled={zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
          >
            <Minus size={19} />
          </button>
          <button
            className="text-button"
            aria-label="Fit image to screen"
            onClick={() => {
              setZoom(1);
              viewport.current?.scrollTo(0, 0);
            }}
          >
            Fit
          </button>
          <button
            className="icon-button"
            aria-label="Zoom in"
            disabled={zoom >= 4}
            onClick={() => setZoom((value) => Math.min(4, value + 0.5))}
          >
            <Plus size={19} />
          </button>
        </div>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close full-screen image"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <div
        ref={viewport}
        className="soulful-image-viewport"
        tabIndex={0}
        aria-label="Illustration; scroll to explore when zoomed"
      >
        <div
          className="soulful-image-canvas"
          style={{
            width: Math.max(size.width, width * fit * zoom),
            height: Math.max(size.height, height * fit * zoom),
          }}
        >
          <img
            src={block.src}
            alt={block.alt || `Illustration from source page ${block.page}`}
            draggable={false}
            style={{
              width: width * fit * zoom,
              height: height * fit * zoom,
              transform: soulfulImageTransform(block.src),
            }}
          />
        </div>
      </div>
      <p className="soulful-image-help">
        {zoom === 1
          ? 'Use + to enlarge the illustration.'
          : 'Scroll or swipe to explore. Choose Fit to see the whole image.'}
      </p>
    </dialog>
  );
}
