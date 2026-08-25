import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeSvgProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39' | 'ITF14';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
  lineColor?: string;
  background?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  format = 'CODE128',
  width = 1.6,
  height = 45,
  displayValue = true,
  fontSize = 12,
  className = '',
  lineColor = '#000000',
  background = 'transparent',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      // Auto-detect format if EAN13 is requested but value isn't 13 digits
      let targetFormat = format;
      const cleanVal = value.trim();

      if (targetFormat === 'EAN13' && cleanVal.length !== 13) {
        targetFormat = 'CODE128';
      }

      JsBarcode(svgRef.current, cleanVal, {
        format: targetFormat,
        lineColor: lineColor,
        background: background,
        width: width,
        height: height,
        displayValue: displayValue,
        fontSize: fontSize,
        font: 'monospace',
        textMargin: 3,
        margin: 4,
        valid: () => {},
      });
    } catch {
      // Fallback cleanly to CODE128
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, value.trim(), {
            format: 'CODE128',
            lineColor: lineColor,
            background: background,
            width: width,
            height: height,
            displayValue: displayValue,
            fontSize: fontSize,
            font: 'monospace',
            textMargin: 3,
            margin: 4,
          });
        }
      } catch (fallbackErr) {
        console.error('Barcode render fallback error:', fallbackErr);
      }
    }
  }, [value, format, width, height, displayValue, fontSize, lineColor, background]);

  if (!value) return null;

  return <svg ref={svgRef} className={`max-w-full inline-block ${className}`} />;
};
