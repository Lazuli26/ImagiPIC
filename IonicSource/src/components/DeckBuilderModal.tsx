import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonButton, IonButtons, IonProgressBar, IonAlert, IonIcon, IonPopover,
} from "@ionic/react";
import { clipboardOutline, imageOutline } from 'ionicons/icons';
import { useImageClipboard } from '../utils/useImageClipboard';
import { ShapeTypes } from "geometrizejs";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoPlayer, GeoPlayerOptions } from "./GeometrizePlayer.tsx/GeoPlayer";
import { GeometrizeOptions } from "../assets/libraries/Geometrize/Types";
import { DeckImageDoc, DeckImageOptions, CompactShapeType, AppSettingsDoc } from "../types/database";
import { saveDeckImage } from "../game/deckOperations";
import { defaultOptions } from "../assets/libraries/Geometrize/defaults";
import {
  decodeAllToSvgRows,
  normalizeAndFlattenShapes,
  unflattenShapes,
} from "../utils/compactShapeCodec";
import InlineSvgPreview from './game/InlineSvgPreview';
import ShapeStylePreview from './ShapeStylePreview';
import { getDocSnap, typedDoc } from "../firebase/firestore";
import {
  normalizeUploadedImage,
  resetFileInput,
  getAcceptAttrForMobile,
} from "../utils/imageUploadUtils";
import CommonsImageSearch from './CommonsImageSearch';
import GoogleImageSearch from './GoogleImageSearch';
import { ImageSourceCredit } from '../utils/commonsImages';
import './DeckBuilderModal.css';

const GOOGLE_PSE_ID = (process.env.REACT_APP_GOOGLE_PSE_ID || '000cddcc20f024e3c').trim();

interface DeckBuilderModalProps {
  ownerUid: string;
  isOpen: boolean;
  onDismiss: () => void;
  onSaved: (savedDoc: DeckImageDoc) => void;
}

const COMPACT_SHAPE_TYPE_MAP: Record<number, CompactShapeType> = {
  [ShapeTypes.ROTATED_RECTANGLE]: CompactShapeType.ROTATED_RECTANGLE,
  [ShapeTypes.ROTATED_ELLIPSE]: CompactShapeType.ROTATED_ELLIPSE,
  [ShapeTypes.TRIANGLE]: CompactShapeType.TRIANGLE,
  [ShapeTypes.CIRCLE]: CompactShapeType.CIRCLE,
  [ShapeTypes.LINE]: CompactShapeType.LINE,
  [ShapeTypes.QUADRATIC_BEZIER]: CompactShapeType.QUADRATIC_BEZIER,
  [ShapeTypes.RECTANGLE]: CompactShapeType.RECTANGLE,
};

const SHAPE_TYPE_SYMBOL: Record<string, string> = {
  ROTATED_RECTANGLE: "▭",
  ROTATED_ELLIPSE: "⬭",
  TRIANGLE: "▲",
  CIRCLE: "●",
  LINE: "━",
  QUADRATIC_BEZIER: "⌒",
  RECTANGLE: "▬",
};

const PARAMETER_HELP = {
  shapeCount: 'Más formas aportan más detalle. Entre 150 y 300 suele ser suficiente; las imágenes con 450 o más tardan más en crearse.',
  candidateShapesPerStep: 'Cantidad de figuras que se prueban antes de elegir una. Un valor mayor puede mejorar el resultado, pero tarda más.',
  shapeMutationsPerStep: 'Pequeños ajustes a cada figura para encontrar el mejor encaje. Más ajustes requieren más tiempo.',
  alpha: 'Las figuras transparentes crean mezclas suaves. Una opacidad mayor da un estilo más sólido y colorido.',
  maxPixels: 'Tamaño de la imagen que analiza el motor. Un valor menor acelera el proceso; uno mayor conserva más detalle.',
  backgroundLoading: 'Crea las formas mientras observas la imagen. Recomendado para preparar las cartas.',
};

const geoShapeTypesEntries = Object.entries(ShapeTypes).filter(
  ([key, value]) => typeof value === "number" && key in SHAPE_TYPE_SYMBOL
);

const SHAPE_LABELS: Record<string, string> = {
  RECTANGLE: 'Rectángulo', ROTATED_RECTANGLE: 'Rectángulo girado', TRIANGLE: 'Triángulo',
  ROTATED_ELLIPSE: 'Elipse girada', CIRCLE: 'Círculo', LINE: 'Línea', QUADRATIC_BEZIER: 'Curva',
};

function renderTemplateShape(key: string, index = 0) {
  const colors = [
    "rgba(56, 128, 255, 0.62)",
    "rgba(162, 89, 255, 0.5)",
    "rgba(47, 201, 117, 0.42)",
    "rgba(255, 159, 10, 0.35)",
  ];
  const color = colors[index % colors.length];
  const offset = index * 6;

  switch (key) {
    case "ROTATED_RECTANGLE":
      return (
        <rect
          key={`${key}-${index}`}
          x={18 + offset}
          y={24 + offset * 0.2}
          width={56}
          height={32}
          rx={4}
          fill={color}
          transform={`rotate(${12 + index * 8} 50 40)`}
        />
      );
    case "ROTATED_ELLIPSE":
      return (
        <ellipse
          key={`${key}-${index}`}
          cx={50}
          cy={44}
          rx={28}
          ry={18}
          fill={color}
          transform={`rotate(${18 + index * 8} 50 44)`}
        />
      );
    case "TRIANGLE":
      return (
        <polygon
          key={`${key}-${index}`}
          points={`22,72 52,16 ${80 - offset},72`}
          fill={color}
        />
      );
    case "CIRCLE":
      return <circle key={`${key}-${index}`} cx={50} cy={48} r={24} fill={color} />;
    case "LINE":
      return (
        <line
          key={`${key}-${index}`}
          x1={20}
          y1={72 - offset}
          x2={78}
          y2={24 + offset}
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
        />
      );
    case "QUADRATIC_BEZIER":
      return (
        <path
          key={`${key}-${index}`}
          d={`M 18 66 Q ${46 + offset} ${12 + offset} 82 60`}
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case "RECTANGLE":
      return (
        <rect
          key={`${key}-${index}`}
          x={20 + offset * 0.25}
          y={24 + offset * 0.25}
          width={56}
          height={36}
          rx={4}
          fill={color}
        />
      );
    default:
      return null;
  }
}

function generateThumbnailDataUrl(imageSrc: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const targetWidth = 48;
          const ratio = img.height / img.width;
          const targetHeight = Math.max(1, Math.round(targetWidth * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(undefined);
            return;
          }
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          if (dataUrl.length < 5 * 1024) {
            resolve(dataUrl);
          } else {
            resolve(undefined);
          }
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = imageSrc;
    } catch {
      resolve(undefined);
    }
  });
}

function generateSquareCropDataUrl(imageSrc: string, crop: SquareCrop): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const size = Math.max(1, Math.round(crop.size));
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to initialize crop canvas."));
            return;
          }
          ctx.drawImage(
            img,
            Math.round(crop.x),
            Math.round(crop.y),
            size,
            size,
            0,
            0,
            size,
            size
          );
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Failed to crop image."));
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for cropping."));
      img.src = imageSrc;
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Failed to crop image."));
    }
  });
}

type Step = 1 | 2;
type SquareCrop = {
  x: number;
  y: number;
  size: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createDefaultSquareCrop(width: number, height: number): SquareCrop {
  const size = Math.min(width, height);
  return {
    x: Math.max(0, (width - size) / 2),
    y: Math.max(0, (height - size) / 2),
    size,
  };
}

function getContainedImageRect(
  stageWidth: number,
  stageHeight: number,
  imageWidth: number,
  imageHeight: number
) {
  if (stageWidth <= 0 || stageHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const stageRatio = stageWidth / stageHeight;
  const imageRatio = imageWidth / imageHeight;

  if (stageRatio > imageRatio) {
    const height = stageHeight;
    const width = height * imageRatio;
    return {
      x: (stageWidth - width) / 2,
      y: 0,
      width,
      height,
    };
  }

  const width = stageWidth;
  const height = width / imageRatio;
  return {
    x: 0,
    y: (stageHeight - height) / 2,
    width,
    height,
  };
}

const DeckBuilderModal: React.FC<DeckBuilderModalProps> = ({
  ownerUid,
  isOpen,
  onDismiss,
  onSaved,
}) => {
  const savePending = useRef(false);
  const imageLoadPending = useRef(false);
  const imageLoadEpoch = useRef(0);
  const generationEpoch = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropStageRef = useRef<HTMLDivElement>(null);
  const playerUiRef = useRef<GeoPlayerOptions | null>(null);
  const cropInteractionRef = useRef<null | {
    mode: "drag" | "resize";
    startClientX: number;
    startClientY: number;
    startCrop: SquareCrop;
  }>(null);

  const [step, setStep] = useState<Step>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSource, setImageSource] = useState<ImageSourceCredit | null>(null);
  const [searchProvider, setSearchProvider] = useState<'google' | 'commons'>(GOOGLE_PSE_ID ? 'google' : 'commons');
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState<string>("");
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");
  const [sourceImageSize, setSourceImageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [cropSquare, setCropSquare] = useState<SquareCrop | null>(null);
  const [cropStageSize, setCropStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [forceSquareImages, setForceSquareImages] = useState<boolean>(false);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);

  const [selectedShapeTypes, setSelectedShapeTypes] = useState<number[]>([
    ShapeTypes.TRIANGLE,
    ShapeTypes.ROTATED_ELLIPSE,
  ]);
  const [shapeCount, setShapeCount] = useState<number>(250);
  const [candidateShapesPerStep, setCandidateShapesPerStep] = useState<number>(50);
  const [shapeMutationsPerStep, setShapeMutationsPerStep] = useState<number>(50);
  const [maxPixels, setMaxPixels] = useState<number>(defaultOptions.maxPixels);
  const [alpha, setAlpha] = useState<number>(128);
  const [label, setLabel] = useState<string>("");

  const [processing, setProcessing] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [processingStarted, setProcessingStarted] = useState<boolean>(false);
  const [loadedShapeCount, setLoadedShapeCount] = useState<number>(0);
  const [previewStepCursor, setPreviewStepCursor] = useState<number>(0);
  const [livePreviewRows, setLivePreviewRows] = useState<string[]>([]);
  const [livePreviewDims, setLivePreviewDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const [saving, setSaving] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<string>("");
  const [alertOpen, setAlertOpen] = useState<boolean>(false);
  const [loadingImage, setLoadingImage] = useState<boolean>(false);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [helpEvent, setHelpEvent] = useState<Event>();
  const builderBodyRef = useRef<HTMLDivElement>(null);

  const resetState = useCallback(() => {
    generationEpoch.current += 1;
    imageLoadEpoch.current += 1;
    imageLoadPending.current = false;
    setStep(1);
    setSelectedFile(null);
    setImageSource(null);
    setSearchProvider(GOOGLE_PSE_ID ? 'google' : 'commons');
    setSourceImageDataUrl("");
    setPreviewDataUrl("");
    setSourceImageSize({ w: 0, h: 0 });
    setCropSquare(null);
    setCropStageSize({ w: 0, h: 0 });
    setSelectedShapeTypes([ShapeTypes.TRIANGLE, ShapeTypes.ROTATED_ELLIPSE]);
    setShapeCount(250);
    setCandidateShapesPerStep(50);
    setShapeMutationsPerStep(50);
    setMaxPixels(defaultOptions.maxPixels);
    setAlpha(128);
    setLabel("");
    setProcessing(false);
    setProgressPct(0);
    setProcessingStarted(false);
    setLoadedShapeCount(0);
    setPreviewStepCursor(0);
    setLivePreviewRows([]);
    setLivePreviewDims({ w: 0, h: 0 });
    setSaving(false);
    setLoadingImage(false);
    resetFileInput(fileInputRef.current);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadSettings = async () => {
      setSettingsLoading(true);
      try {
        const snap = await getDocSnap(typedDoc<AppSettingsDoc>("app_settings", "gameplay"));
        if (cancelled) return;

        const exists = snap.exists();
        const data = exists ? snap.data() : undefined;
        const flag = Boolean(exists && data?.forceSquareImages);

        setForceSquareImages(flag);
      } catch (_error) {
        if (cancelled) return;
        setForceSquareImages(false);
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const loadImageFile = useCallback(async (file: File, source?: ImageSourceCredit) => {
    if (imageLoadPending.current) return;
    imageLoadPending.current = true;
    const epoch = ++imageLoadEpoch.current;
    setLoadingImage(true);
    try {
      const result = await normalizeUploadedImage(file, 262144 * 4, 0.92);
      if (imageLoadEpoch.current !== epoch) return;
      setSelectedFile(file);
      setImageSource(source || null);
      setSourceImageDataUrl(result.dataUrl);
      setPreviewDataUrl(result.dataUrl);
      setSourceImageSize({ w: result.width, h: result.height });
      setCropSquare(createDefaultSquareCrop(result.width, result.height));
    } catch (_error) {
      if (imageLoadEpoch.current !== epoch) return;
      setAlertMsg('No se pudo abrir esa imagen. Prueba con un archivo JPG o PNG, o una captura de pantalla. Si usas HEIC, conviértela primero a un formato compatible.');
      setAlertOpen(true);
    } finally {
      if (imageLoadEpoch.current === epoch) {
        imageLoadPending.current = false; setLoadingImage(false); resetFileInput(fileInputRef.current);
      }
    }
  }, []);
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadImageFile(file);
  };
  const clipboard = useImageClipboard(isOpen && step === 1 && !loadingImage && !processing && !saving, loadImageFile);
  useEffect(() => () => { imageLoadEpoch.current += 1; }, []);

  useEffect(() => {
    if (!sourceImageDataUrl) {
      setSourceImageSize({ w: 0, h: 0 });
      setCropSquare(null);
      return;
    }
    if (sourceImageSize.w > 0 && sourceImageSize.h > 0 && cropSquare) {
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setSourceImageSize((prev) =>
        prev.w > 0 && prev.h > 0 ? prev : { w: img.width, h: img.height }
      );
      setCropSquare((prev) => prev ?? createDefaultSquareCrop(img.width, img.height));
    };
    img.src = sourceImageDataUrl;

    return () => {
      cancelled = true;
    };
  }, [sourceImageDataUrl, sourceImageSize.w, sourceImageSize.h, cropSquare]);

  useEffect(() => {
    if (!isOpen || !forceSquareImages) return;
    const stage = cropStageRef.current;
    if (!stage) return;

    const updateSize = () => {
      setCropStageSize({ w: stage.clientWidth, h: stage.clientHeight });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);

    return () => {
      observer.disconnect();
    };
  }, [forceSquareImages, isOpen, sourceImageDataUrl]);

  const cropImageRect = useMemo(
    () =>
      getContainedImageRect(
        cropStageSize.w,
        cropStageSize.h,
        sourceImageSize.w,
        sourceImageSize.h
      ),
    [cropStageSize.h, cropStageSize.w, sourceImageSize.h, sourceImageSize.w]
  );

  const cropDisplayBox = useMemo(() => {
    if (!cropSquare || !cropImageRect || sourceImageSize.w <= 0) return null;
    const scale = cropImageRect.width / sourceImageSize.w;
    return {
      left: cropImageRect.x + cropSquare.x * scale,
      top: cropImageRect.y + cropSquare.y * scale,
      size: cropSquare.size * scale,
    };
  }, [cropImageRect, cropSquare, sourceImageSize.w]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = cropInteractionRef.current;
      if (!interaction || !cropImageRect || sourceImageSize.w <= 0 || sourceImageSize.h <= 0) return;

      const scale = cropImageRect.width / sourceImageSize.w;
      const dx = (event.clientX - interaction.startClientX) / scale;
      const dy = (event.clientY - interaction.startClientY) / scale;
      const minSize = Math.max(64, Math.round(Math.min(sourceImageSize.w, sourceImageSize.h) * 0.2));

      if (interaction.mode === "drag") {
        const nextX = clamp(
          interaction.startCrop.x + dx,
          0,
          Math.max(0, sourceImageSize.w - interaction.startCrop.size)
        );
        const nextY = clamp(
          interaction.startCrop.y + dy,
          0,
          Math.max(0, sourceImageSize.h - interaction.startCrop.size)
        );
        setCropSquare({
          x: nextX,
          y: nextY,
          size: interaction.startCrop.size,
        });
        return;
      }

      const requestedSize = interaction.startCrop.size + Math.max(dx, dy);
      const maxSize = Math.min(
        sourceImageSize.w - interaction.startCrop.x,
        sourceImageSize.h - interaction.startCrop.y
      );
      const nextSize = clamp(requestedSize, minSize, maxSize);
      setCropSquare({
        x: interaction.startCrop.x,
        y: interaction.startCrop.y,
        size: nextSize,
      });
    };

    const stopInteraction = () => {
      cropInteractionRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopInteraction);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopInteraction);
    };
  }, [cropImageRect, sourceImageSize.h, sourceImageSize.w]);

  const beginCropInteraction = (
    event: React.PointerEvent<HTMLDivElement>,
    mode: "drag" | "resize"
  ) => {
    if (!cropSquare) return;
    event.preventDefault();
    event.stopPropagation();
    cropInteractionRef.current = {
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop: cropSquare,
    };
  };

  const toggleShapeType = (type: number) => {
    setSelectedShapeTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const applyOptionsToPlayer = () => {
    const ui = playerUiRef.current;
    if (!ui) return;
    const opts: Partial<GeometrizeOptions> = {
      shapeTypes: selectedShapeTypes,
      candidateShapesPerStep,
      shapeMutationsPerStep,
      alpha,
      maxPixels,
    };
    ui.options(opts);
    ui.set_cap(shapeCount);
    ui.background_loading(true);
  };

  useEffect(() => {
    applyOptionsToPlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShapeTypes, shapeCount, candidateShapesPerStep, shapeMutationsPerStep, alpha, maxPixels]);

  const goToStep2 = async () => {
    if (!selectedFile || !sourceImageDataUrl) return;

    if (forceSquareImages) {
      if (!cropSquare) return;
      try {
        const croppedDataUrl = await generateSquareCropDataUrl(sourceImageDataUrl, cropSquare);
        setPreviewDataUrl(croppedDataUrl);
      } catch (error) {
        setAlertMsg(error instanceof Error ? error.message : "Failed to crop image.");
        setAlertOpen(true);
        return;
      }
    } else {
      setPreviewDataUrl(sourceImageDataUrl);
    }

    setStep(2);
  };

  const resetGeneration = () => {
    generationEpoch.current += 1;
    playerUiRef.current?.play_pause(false);
    playerUiRef.current?.background_loading(false);
    setProcessingStarted(false);
    setProcessing(false);
    setProgressPct(0);
    setLoadedShapeCount(0);
    setPreviewStepCursor(0);
    setLivePreviewRows([]);
    setLivePreviewDims({ w: 0, h: 0 });
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };
  const editRecipe = (change: () => void) => { resetGeneration(); change(); };
  const backToImage = () => { resetGeneration(); setStep(1); };
  const focusSearch = () => builderBodyRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();

  const discardSelectedImage = () => {
    setSelectedFile(null);
    setImageSource(null);
    setSourceImageDataUrl("");
    setPreviewDataUrl("");
    setSourceImageSize({ w: 0, h: 0 });
    setCropSquare(null);
    setCropStageSize({ w: 0, h: 0 });
    setStep(1);
    setProcessingStarted(false);
    setProcessing(false);
    setProgressPct(0);
    setLoadedShapeCount(0);
    setPreviewStepCursor(0);
    setLivePreviewRows([]);
    setLivePreviewDims({ w: 0, h: 0 });
    resetFileInput(fileInputRef.current);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const refreshLivePreview = useCallback(async (epoch: number) => {
    const ui = playerUiRef.current;
    if (!ui) return null;
    try {
      const controller = ui.ControllerInstance.current;
      const compactRows = await controller.getShapesCompact();
      if (generationEpoch.current !== epoch) return null;
      const bmp = controller.currentBitMap;
      const w = bmp?.width ?? livePreviewDims.w;
      const h = bmp?.height ?? livePreviewDims.h;
      if (w > 0 && h > 0) {
        const rows = unflattenShapes(compactRows);
        const svgRows = decodeAllToSvgRows(rows, w, h);
        setLivePreviewRows(svgRows);
        setLivePreviewDims({ w, h });
        setLoadedShapeCount(rows.length);
        return rows.length;
      }
    } catch (error) {
    }
    return null;
  }, [livePreviewDims.w, livePreviewDims.h]);

  const startProcessing = async () => {
    const ui = playerUiRef.current;
    if (!ui || !previewDataUrl) return;
    const epoch = ++generationEpoch.current;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProcessing(true);
    setProcessingStarted(true);
    setProgressPct(0);
    setLoadedShapeCount(0);
    setPreviewStepCursor(0);
    setLivePreviewRows([]);
    setLivePreviewDims({ w: 0, h: 0 });
    applyOptionsToPlayer();

    try {
      if (!await ui.set_image(previewDataUrl)) throw new Error('No se pudo preparar la imagen.');
    } catch {
      if (generationEpoch.current !== epoch) return;
      resetGeneration();
      setAlertMsg('No se pudo crear la imagen. Inténtalo de nuevo.');
      setAlertOpen(true);
      return;
    }
    if (generationEpoch.current !== epoch) return;
    const initialCount = await refreshLivePreview(epoch);
    if (generationEpoch.current !== epoch) return;
    if (typeof initialCount === "number") {
      setPreviewStepCursor(initialCount);
      setProgressPct(Math.min(100, (initialCount / Math.max(1, shapeCount)) * 100));
    }

    progressIntervalRef.current = setInterval(async () => {
      const currentUi = playerUiRef.current;
      if (!currentUi || generationEpoch.current !== epoch) return;
      try {
        const refreshedCount = await refreshLivePreview(epoch);
        if (generationEpoch.current !== epoch) return;
        const count = Math.max(0, refreshedCount ?? 0);
        const pct = Math.min(100, (count / Math.max(1, shapeCount)) * 100);
        setProgressPct(pct);
        setPreviewStepCursor(prev => Math.max(prev, count));
        if (count >= shapeCount) {
          setProcessing(false);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }
      } catch (error) {
      }
    }, 1000);
  };

  const canSave = processingStarted && loadedShapeCount >= shapeCount && !processing && !saving;

  const handleSave = async () => {
    const ui = playerUiRef.current;
    if (!ui || !canSave || !selectedFile || savePending.current) return;
    savePending.current = true;
    setSaving(true);
    try {
      ui.play_pause(false);
      ui.background_loading(false);
      const compactShapes = await ui.ControllerInstance.current.getShapesCompact();
      const jsonShapes = await ui.get_JSON_shapes();

      const actualShapeCount = Math.min(shapeCount, Math.max(compactShapes.length, jsonShapes.length));
      const width =
        ui.ControllerInstance.current.currentBitMap?.width ??
        (jsonShapes.length > 0 ? 512 : 0);
      const height =
        ui.ControllerInstance.current.currentBitMap?.height ??
        (jsonShapes.length > 0 ? 512 : 0);

      const currentOpts = ui.options();
      const deckOptions: DeckImageOptions = {
        shapeTypes: selectedShapeTypes
          .map((s) => COMPACT_SHAPE_TYPE_MAP[s])
          .filter((v): v is CompactShapeType => v !== undefined),
        candidateShapesPerStep: currentOpts.candidateShapesPerStep ?? candidateShapesPerStep,
        shapeMutationsPerStep: currentOpts.shapeMutationsPerStep ?? shapeMutationsPerStep,
        alpha: currentOpts.alpha ?? alpha,
        maxPixels: currentOpts.maxPixels ?? maxPixels,
      };

      const thumb = await generateThumbnailDataUrl(previewDataUrl);

      const payload = {
        label: label.trim().length ? label.trim() : undefined,
        width,
        height,
        shapeCount: actualShapeCount,
        options: deckOptions,
        shapesCompact: normalizeAndFlattenShapes(compactShapes),
        previewDataUrl: thumb,
        ...(imageSource ? { imageSource } : {}),
      };

      const savedDoc = await saveDeckImage(ownerUid, payload);
      onSaved(savedDoc);
      onDismiss();
    } catch (err: any) {
      setAlertMsg(err?.message || 'No se pudo guardar la imagen. Inténtalo de nuevo.');
      setAlertOpen(true);
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

  const busy = processing || saving || loadingImage;
  return (
    <>
      <IonModal className="deck-builder-modal" isOpen={isOpen} onDidDismiss={onDismiss} onDidPresent={focusSearch} backdropDismiss={!busy}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start"><IonButton onClick={onDismiss} disabled={saving}>Cancelar</IonButton></IonButtons>
            <IonTitle>{step === 1 ? 'Elige una imagen' : 'Crea tu carta'}</IonTitle>
            <IonButtons slot="end"><IonButton aria-label="Ayuda para crear una carta" onClick={event => setHelpEvent(event.nativeEvent)}>?</IonButton></IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div ref={builderBodyRef} className={`builder-body builder-screen-${step}`}>
            <div hidden aria-hidden="true">{isOpen && <GeoPlayer playerUiRef={playerUiRef} hideControls={true} width="300px" height="300px" />}</div>
            {step === 1 && <>
              <input ref={fileInputRef} type="file" accept={getAcceptAttrForMobile()} aria-hidden="true" tabIndex={-1} hidden onChange={onFileChange} />
              {!sourceImageDataUrl ? <>
                <div className="image-search-tabs" role="group" aria-label="Fuente de imágenes">
                  {GOOGLE_PSE_ID && <button type="button" aria-pressed={searchProvider === 'google'} className={searchProvider === 'google' ? 'is-active' : ''} onClick={() => setSearchProvider('google')}>Google</button>}
                  <button type="button" aria-pressed={searchProvider === 'commons'} className={searchProvider === 'commons' ? 'is-active' : ''} onClick={() => setSearchProvider('commons')}>Wikimedia Commons</button>
                </div>
                {GOOGLE_PSE_ID && searchProvider === 'google'
                  ? <GoogleImageSearch engineId={GOOGLE_PSE_ID} onSelect={loadImageFile} disabled={loadingImage} autoFocus />
                  : <CommonsImageSearch onSelect={loadImageFile} disabled={loadingImage} autoFocus />}
              </> : <>
                <div className="builder-source-preview">
                  {forceSquareImages ? <div ref={cropStageRef} className="builder-crop-stage">
                    <img src={sourceImageDataUrl} alt="Imagen para recortar" />
                    {cropDisplayBox && <div className="builder-crop-box" onPointerDown={event => beginCropInteraction(event, 'drag')}
                      style={{ left: cropDisplayBox.left, top: cropDisplayBox.top, width: cropDisplayBox.size, height: cropDisplayBox.size }}>
                      <div className="builder-crop-handle" role="presentation" onPointerDown={event => beginCropInteraction(event, 'resize')} />
                    </div>}
                  </div> : <img src={sourceImageDataUrl} alt="Imagen seleccionada" />}
                  <button type="button" className="builder-discard" aria-label="Descartar imagen seleccionada" disabled={loadingImage} onClick={discardSelectedImage}>×</button>
                </div>
                <p className="builder-image-ready" role="status">Imagen preparada · {sourceImageSize.w} × {sourceImageSize.h} px</p>
                {forceSquareImages && <p className="builder-format-note">Arrastra el recorte y su esquina para ajustar el encuadre.</p>}
                {imageSource && <details className="builder-source-credit"><summary>Fuente y licencia</summary>{imageSource.title} · {imageSource.artist} · {imageSource.license} · <a href={imageSource.pageUrl} target="_blank" rel="noopener noreferrer">Ver página original ↗</a></details>}
              </>}
              <div className="builder-import-actions">
                <IonButton fill="clear" size="small" disabled={loadingImage || clipboard.reading} onClick={() => fileInputRef.current?.click()}><IonIcon slot="start" icon={imageOutline} />{sourceImageDataUrl ? 'Cambiar archivo' : 'Adjuntar archivo'}</IonButton>
                <IonButton fill="clear" size="small" disabled={loadingImage || clipboard.reading} onClick={clipboard.read}><IonIcon slot="start" icon={clipboardOutline} />{clipboard.reading ? 'Leyendo…' : 'Pegar imagen'}</IonButton>
              </div>
              {loadingImage && <p role="status" className="builder-format-note">Preparando imagen…</p>}
              {clipboard.error && <p className="clipboard-error" role="status">{clipboard.error}</p>}
            </>}
            {step === 2 && <>
              <label className={`builder-name${label.trim() ? '' : ' is-empty'}`} htmlFor="builder-card-name">
                <span className="builder-name-heading">Ponle nombre a tu carta <small>Opcional</small></span>
                <input id="builder-card-name" aria-label="Nombre de la carta" aria-describedby="builder-name-hint" placeholder="Ej.: Un gato astronauta" maxLength={80} value={label} disabled={saving} onChange={event => setLabel(event.target.value)} />
                <small id="builder-name-hint">Así podrás reconocerla en tu mazo.</small>
              </label>
              <div className="builder-canvas" aria-label="Vista previa de la carta">
                {processingStarted && livePreviewDims.w > 0 && livePreviewRows.length > 0
                  ? <InlineSvgPreview shapes={livePreviewRows} step={previewStepCursor} width={livePreviewDims.w} height={livePreviewDims.h} />
                  : !processingStarted && <ShapeStylePreview imageSrc={previewDataUrl} shapeTypes={selectedShapeTypes} alpha={alpha}
                    candidateShapesPerStep={candidateShapesPerStep} shapeMutationsPerStep={shapeMutationsPerStep} maxPixels={maxPixels} />}
                {processing && <span className="builder-progress-label" role="status">Creando formas · {Math.floor(progressPct)}%</span>}
              </div>
              {processingStarted && <div className="builder-playback-slider">
                <label htmlFor="builder-preview-cursor">{previewStepCursor} / {Math.max(shapeCount, loadedShapeCount)} formas</label>
                <input id="builder-preview-cursor" type="range" aria-label="Formas visibles" min={0} max={Math.max(shapeCount, loadedShapeCount)} value={previewStepCursor} onChange={event => setPreviewStepCursor(Number(event.target.value))} />
                {processing && <IonProgressBar value={progressPct / 100} />}
              </div>}
              <fieldset className="builder-shapes" disabled={busy}>
                <legend>Formas de tu carta</legend>
                <div>{geoShapeTypesEntries.map(([key, value]) => <button type="button" key={key} aria-pressed={selectedShapeTypes.includes(Number(value))}
                  onClick={() => editRecipe(() => toggleShapeType(Number(value)))}>
                  <svg viewBox="0 0 100 100" aria-hidden="true">{renderTemplateShape(key)}</svg>{SHAPE_LABELS[key] || key}
                </button>)}</div>
              </fieldset>
              {selectedShapeTypes.length === 0 && <p className="builder-error" role="status">Elige al menos una forma.</p>}
              <details className="builder-advanced">
                <summary>Ajustes de imagen</summary>
                <fieldset disabled={busy}>
                  <label>Cantidad de formas · {shapeCount}<input type="range" min={50} max={500} step={50} value={shapeCount} onChange={event => editRecipe(() => setShapeCount(Number(event.target.value)))} /></label>
                  <p>{PARAMETER_HELP.shapeCount}</p>
                  <label>Opacidad · {alpha}<input type="range" min={32} max={255} value={alpha} onChange={event => editRecipe(() => setAlpha(Number(event.target.value)))} /></label>
                  <p>{PARAMETER_HELP.alpha}</p>
                  <details><summary>Más ajustes</summary>
                    <label>Candidatas por paso<input type="number" min={10} max={200} value={candidateShapesPerStep} onChange={event => editRecipe(() => setCandidateShapesPerStep(clamp(Number(event.target.value) || 10, 10, 200)))} /></label>
                    <p>{PARAMETER_HELP.candidateShapesPerStep}</p>
                    <label>Ajustes por paso<input type="number" min={10} max={200} value={shapeMutationsPerStep} onChange={event => editRecipe(() => setShapeMutationsPerStep(clamp(Number(event.target.value) || 10, 10, 200)))} /></label>
                    <p>{PARAMETER_HELP.shapeMutationsPerStep}</p>
                    <label>Píxeles máximos<input type="number" min={65536} max={2097152} step={65536} value={maxPixels} onChange={event => editRecipe(() => setMaxPixels(clamp(Number(event.target.value) || 65536, 65536, 2097152)))} /></label>
                    <p>{PARAMETER_HELP.maxPixels}</p>
                  </details>
                </fieldset>
              </details>
            </>}
          </div>
        </IonContent>
        {((step === 1 && sourceImageDataUrl) || step === 2) && <IonFooter className="builder-footer"><div>
          {step === 1 ? <IonButton expand="block" disabled={busy || settingsLoading} onClick={goToStep2}>Continuar →</IonButton> : <>
            <IonButton fill="clear" disabled={busy} onClick={backToImage}>Cambiar imagen</IonButton>
            {processingStarted && !processing && <IonButton fill="clear" disabled={saving} onClick={startProcessing}>Rehacer</IonButton>}
            <IonButton className="builder-primary-action" disabled={busy || selectedShapeTypes.length === 0} onClick={canSave ? handleSave : startProcessing}>
              {saving ? 'Guardando…' : processing ? 'Creando…' : canSave ? 'Guardar carta' : 'Crear formas'}
            </IonButton>
          </>}
        </div></IonFooter>}
      </IonModal>
      <IonPopover isOpen={!!helpEvent} event={helpEvent} onDidDismiss={() => setHelpEvent(undefined)} className="builder-help-popover">
        <div className="builder-help"><strong>{step === 1 ? 'De una imagen a una carta' : 'Dale tu estilo'}</strong>
          <p>{step === 1 ? 'Busca una imagen y selecciónala. También puedes adjuntar un archivo o pegar una captura con Ctrl/Cmd + V.' : 'Las formas seleccionadas funcionan con los ajustes recomendados. Pulsa Crear formas, revisa el resultado y guarda la carta en tu mazo. Puedes cambiar el detalle en Ajustes de imagen.'}</p>
          <IonButton fill="clear" size="small" onClick={() => setHelpEvent(undefined)}>Entendido</IonButton>
        </div>
      </IonPopover>
      <IonAlert isOpen={alertOpen} message={alertMsg} buttons={[{ text: 'OK', handler: () => setAlertOpen(false) }]} onDidDismiss={() => setAlertOpen(false)} />
    </>
  );
};

export default DeckBuilderModal;
export { DeckBuilderModal };
