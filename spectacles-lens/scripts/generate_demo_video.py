import os
import sys
import glob
import json
import math
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Dimensions
WIDTH = 1920
HEIGHT = 1080
FPS = 30

FRAMES_DIR = r"c:\Users\ruanc\source\repos\SpecScribe\spectacles-lens\recorded_frames"
OUTPUT_VIDEO = r"c:\Users\ruanc\source\repos\SpecScribe\SpecScribe_Lens_Studio_Preview_Demo.mp4"
ARTIFACT_VIDEO = r"C:\Users\ruanc\.gemini\antigravity-ide\brain\88c882f4-e273-4a07-8f45-02fc78e96bd8\SpecScribe_Lens_Studio_Preview_Demo.mp4"

# Stage definitions matching the 8 stages of the demo journey
STAGES = [
    {
        "index": 1,
        "title": "SPATIAL ROOM CALIBRATION",
        "subtitle": "Wall plane detection and high whiteboard bounding box selection in physical space",
        "tag": "STAGE 1 OF 8 • ROOM SETUP",
        "tag_color": (0, 210, 255), # Cyan
    },
    {
        "index": 2,
        "title": "RESIZING & EYE-LEVEL LOCK",
        "subtitle": "Lowered 30cm to ergonomic eye level, stretched to 120x76cm, and locked via center pinch",
        "tag": "STAGE 2 OF 8 • CALIBRATION",
        "tag_color": (0, 230, 150), # Mint
    },
    {
        "index": 3,
        "title": "WHITEBOARD INGESTION & SUGIYAMA DAG",
        "subtitle": "Ingesting marker drawing: 4-node directed graph (Client HTTPS -> Gateway -> Engine -> DB)",
        "tag": "STAGE 3 OF 8 • INGESTION",
        "tag_color": (50, 150, 255), # Blue
    },
    {
        "index": 4,
        "title": "SIK COMPONENT PALETTE INJECTION",
        "subtitle": "Pinching 'Decision' button injects [Verify JWT HMAC-SHA256] node with auto-layout",
        "tag": "STAGE 4 OF 8 • MODELING",
        "tag_color": (255, 190, 40), # Amber
    },
    {
        "index": 5,
        "title": "PROACTIVE AI PEER REVIEW ALERT",
        "subtitle": "AI Orb raises hand in peripheral vision with alert: [! Auth Token Leak Risk]",
        "tag": "STAGE 5 OF 8 • PROACTIVE AI",
        "tag_color": (255, 100, 100), # Coral Red
    },
    {
        "index": 6,
        "title": "DETAILED CRITIQUE CARD EXPANSION",
        "subtitle": "Direct hand pinch on AI Orb expands security analysis: unsigned token vulnerability & fix",
        "tag": "STAGE 6 OF 8 • AI COLLABORATION",
        "tag_color": (200, 100, 255), # Violet
    },
    {
        "index": 7,
        "title": "MULTI-TIER SNAPSHOT RE-ROUTING",
        "subtitle": "Pinching 'Update Snapshot' generates multi-tier DAG with Ingress LB and Auth Validator",
        "tag": "STAGE 7 OF 8 • ARCHITECTURE",
        "tag_color": (0, 220, 200), # Teal
    },
    {
        "index": 8,
        "title": "SESSION CONCLUSION & SPEC EXPORT",
        "subtitle": "Formal meeting conclusion: automated Markdown & OpenAPI technical specification export",
        "tag": "STAGE 8 OF 8 • SPEC EXPORT",
        "tag_color": (50, 220, 100), # Green
    }
]

def get_font(size, bold=False):
    font_names = [
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibrib.ttf" if bold else "C:\\Windows\\Fonts\\calibri.ttf",
    ]
    for fn in font_names:
        if os.path.exists(fn):
            try:
                return ImageFont.truetype(fn, size)
            except Exception:
                pass
    return ImageFont.load_default()

def crop_and_resize(img_path):
    img = cv2.imread(img_path)
    if img is None:
        return np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    
    h, w, _ = img.shape
    # Crop top 90px to remove LEAF runner banner
    top_y = min(90, int(h * 0.06))
    bot_y = h
    crop_h = bot_y - top_y
    crop_w = int(crop_h * (16.0 / 9.0))
    if crop_w > w:
        crop_w = w
        crop_h = int(crop_w * (9.0 / 16.0))
    
    x1 = (w - crop_w) // 2
    x2 = x1 + crop_w
    y1 = top_y
    y2 = y1 + crop_h
    
    cropped = img[y1:y2, x1:x2]
    resized = cv2.resize(cropped, (WIDTH, HEIGHT), interpolation=cv2.INTER_CUBIC)
    return resized

def create_title_slide(duration_sec=3.5):
    frames = []
    total_frames = int(duration_sec * FPS)
    
    font_hero = get_font(72, bold=True)
    font_sub = get_font(32, bold=False)
    font_tag = get_font(22, bold=True)
    font_meta = get_font(20, bold=False)
    
    for i in range(total_frames):
        alpha = 1.0
        # Fade in over first 20 frames, fade out over last 15
        if i < 20:
            alpha = i / 20.0
        elif i > total_frames - 15:
            alpha = (total_frames - i) / 15.0
            
        # Background gradient: Dark Slate Blue to Midnight Navy
        bg = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
        for y in range(HEIGHT):
            ratio = y / HEIGHT
            b = int(22 * (1 - ratio) + 12 * ratio)
            g = int(18 * (1 - ratio) + 10 * ratio)
            r = int(14 * (1 - ratio) + 8 * ratio)
            bg[y, :] = (b, g, r)
            
        pil_img = Image.fromarray(cv2.cvtColor(bg, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_img)
        
        # Draw glowing decorative border / accents
        box_margin = 120
        draw.rounded_rectangle(
            [box_margin, box_margin, WIDTH - box_margin, HEIGHT - box_margin],
            radius=24,
            outline=(40, 60, 90),
            width=2
        )
        
        # Tag badge
        draw.rounded_rectangle([WIDTH//2 - 240, 240, WIDTH//2 + 240, 285], radius=12, fill=(20, 45, 75))
        draw.text((WIDTH//2, 262), "SNAP SPECTACLES (SPECS 27) • AR DEMO", font=font_tag, fill=(0, 210, 255), anchor="mm")
        
        # Main Title
        draw.text((WIDTH//2, 380), "SpecScribe", font=font_hero, fill=(255, 255, 255), anchor="mm")
        
        # Subtitle
        draw.text((WIDTH//2, 470), "Spatial Architecture Modeling & Proactive AI Peer Review", font=font_sub, fill=(210, 225, 245), anchor="mm")
        
        # Feature highlight pills
        features = [
            "Real-Time Whiteboard Marker Ingestion",
            "Deterministic Sugiyama DAG Layout",
            "Proactive Peripheral AI Teammate",
            "Instant Markdown & OpenAPI Export"
        ]
        
        start_y = 560
        for idx, feat in enumerate(features):
            col = idx % 2
            row = idx // 2
            bx = WIDTH//2 - 380 + col * 400
            by = start_y + row * 60
            draw.rounded_rectangle([bx, by, bx + 360, by + 46], radius=8, fill=(25, 35, 50), outline=(50, 70, 100), width=1)
            draw.text((bx + 180, by + 23), f"•  {feat}", font=font_meta, fill=(180, 215, 240), anchor="mm")
            
        draw.text((WIDTH//2, 780), "Live Interactive Preview Experience inside Lens Studio", font=font_meta, fill=(120, 150, 180), anchor="mm")
        
        frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        if alpha < 1.0:
            frame = (frame * alpha).astype(np.uint8)
        frames.append(frame)
        
    return frames

def create_outro_slide(duration_sec=3.5):
    frames = []
    total_frames = int(duration_sec * FPS)
    
    font_hero = get_font(56, bold=True)
    font_sub = get_font(28, bold=False)
    font_tag = get_font(20, bold=True)
    font_text = get_font(22, bold=False)
    
    for i in range(total_frames):
        alpha = 1.0
        if i < 20:
            alpha = i / 20.0
        elif i > total_frames - 15:
            alpha = (total_frames - i) / 15.0
            
        bg = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
        for y in range(HEIGHT):
            ratio = y / HEIGHT
            b = int(24 * (1 - ratio) + 14 * ratio)
            g = int(20 * (1 - ratio) + 12 * ratio)
            r = int(16 * (1 - ratio) + 10 * ratio)
            bg[y, :] = (b, g, r)
            
        pil_img = Image.fromarray(cv2.cvtColor(bg, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_img)
        
        # Outro Title
        draw.rounded_rectangle([WIDTH//2 - 200, 200, WIDTH//2 + 200, 245], radius=12, fill=(20, 60, 45))
        draw.text((WIDTH//2, 222), "SESSION COMPLETED • VERIFIED", font=font_tag, fill=(0, 240, 160), anchor="mm")
        
        draw.text((WIDTH//2, 320), "Architecture Specification Generated", font=font_hero, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, 390), "Exported: System DAG • Security Review Log • OpenAPI Contract", font=font_sub, fill=(200, 220, 240), anchor="mm")
        
        # Metrics Card
        draw.rounded_rectangle([WIDTH//2 - 400, 450, WIDTH//2 + 400, 660], radius=16, fill=(25, 35, 52), outline=(50, 75, 110), width=2)
        
        metrics = [
            ("Hardware Target", "Snap Spectacles (2024 / SPECS 27)"),
            ("Rendering Engine", "Lens Studio 5.22+ Native Preview"),
            ("Interaction Model", "Spectacles Interaction Kit (SIK) Hand Tracking"),
            ("AI Capabilities", "Proactive Multi-Modal Critique & Vulnerability Guardrails")
        ]
        
        for m_idx, (k, v) in enumerate(metrics):
            y_pos = 485 + m_idx * 40
            draw.text((WIDTH//2 - 360, y_pos), k, font=font_tag, fill=(130, 170, 210))
            draw.text((WIDTH//2 + 360, y_pos), v, font=font_text, fill=(240, 245, 255), anchor="ra")
            
        draw.text((WIDTH//2, 730), "SpecScribe • Autonomous Spatial Whiteboard Copilot", font=font_tag, fill=(0, 210, 255), anchor="mm")
        draw.text((WIDTH//2, 765), "Built for Learn AR with SPECS • Devpost AR Hackathon", font=font_text, fill=(140, 160, 180), anchor="mm")
        
        frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        if alpha < 1.0:
            frame = (frame * alpha).astype(np.uint8)
        frames.append(frame)
        
    return frames

def overlay_stage_hud(frame_bgr, stage_info, progress=0.5):
    """
    Overlays a sleek, modern, non-intrusive lower-third glass card
    displaying the stage title, badge, and technical narrative.
    """
    h, w, _ = frame_bgr.shape
    overlay = frame_bgr.copy()
    
    # Glass card dimensions at bottom
    card_x1 = 80
    card_y1 = h - 180
    card_x2 = w - 80
    card_y2 = h - 45
    
    # Draw frosted dark background
    cv2.rectangle(overlay, (card_x1, card_y1), (card_x2, card_y2), (18, 22, 30), -1)
    
    # Blend with original for glassmorphism
    alpha = 0.88
    cv2.addWeighted(overlay, alpha, frame_bgr, 1 - alpha, 0, frame_bgr)
    
    # Border
    cv2.rectangle(frame_bgr, (card_x1, card_y1), (card_x2, card_y2), (60, 80, 110), 2)
    
    # Left accent indicator bar
    tag_col = stage_info.get("tag_color", (0, 210, 255))
    cv2.rectangle(frame_bgr, (card_x1, card_y1), (card_x1 + 8, card_y2), tag_col, -1)
    
    # Convert to PIL for crisp typography
    pil_img = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil_img)
    
    font_tag = get_font(18, bold=True)
    font_title = get_font(28, bold=True)
    font_sub = get_font(21, bold=False)
    font_brand = get_font(16, bold=True)
    
    # Text positions
    text_x = card_x1 + 30
    draw.text((text_x, card_y1 + 18), stage_info["tag"], font=font_tag, fill=tag_col)
    draw.text((text_x, card_y1 + 44), stage_info["title"], font=font_title, fill=(255, 255, 255))
    draw.text((text_x, card_y1 + 84), stage_info["subtitle"], font=font_sub, fill=(200, 215, 235))
    
    # Right watermark in card
    draw.text((card_x2 - 25, card_y1 + 20), "SPECSCRIBE // AR PREVIEW", font=font_brand, fill=(90, 120, 150), anchor="ra")
    
    # Thin progress line at top of card
    prog_w = int((card_x2 - card_x1) * progress)
    draw.rectangle([card_x1, card_y1, card_x1 + prog_w, card_y1 + 3], fill=tag_col)
    
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

def main():
    print("=== Compiling SpecScribe Lens Studio Demo Video ===")
    
    frame_files = sorted(glob.glob(os.path.join(FRAMES_DIR, "frame_*.jpg")))
    print(f"Found {len(frame_files)} captured preview frames in {FRAMES_DIR}")
    
    if len(frame_files) == 0:
        print("ERROR: No recorded frames found!")
        sys.exit(1)
        
    # Read metadata if present
    meta_path = os.path.join(FRAMES_DIR, "metadata.json")
    meta = []
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r") as f:
                meta = json.load(f)
        except Exception as e:
            print("Notice: Could not parse metadata:", e)
            
    # Set up VideoWriter
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(OUTPUT_VIDEO, fourcc, FPS, (WIDTH, HEIGHT))
    
    if not out.isOpened():
        print(f"ERROR: Could not open VideoWriter for {OUTPUT_VIDEO}")
        sys.exit(1)
        
    print("1. Generating Intro Title Sequence...")
    intro_frames = create_title_slide(duration_sec=3.2)
    for f in intro_frames:
        out.write(f)
        
    print("2. Processing Preview Frames & Compositing Stage HUDs...")
    total_captured = len(frame_files)
    
    # Map metadata elapsed times
    elapsed_map = {}
    if isinstance(meta, list):
        for item in meta:
            fn = item.get("filename")
            el = item.get("elapsedSeconds")
            if fn and el is not None:
                elapsed_map[fn] = el
                
    STAGE_CUTOFFS = [3.9, 8.2, 12.2, 16.2, 20.2, 24.7, 28.7, 999.0]
    
    # Map frames to the 8 stages by elapsed timestamp or progress
    for idx, fpath in enumerate(frame_files):
        processed = crop_and_resize(fpath)
        fname = os.path.basename(fpath)
        
        if fname in elapsed_map:
            elapsed = elapsed_map[fname]
            stage_idx = 7
            for s_i, cutoff in enumerate(STAGE_CUTOFFS):
                if elapsed <= cutoff:
                    stage_idx = s_i
                    break
            progress = min(max(elapsed / 33.0, 0.0), 1.0)
        else:
            progress = idx / float(total_captured - 1) if total_captured > 1 else 0
            stage_idx = min(int(progress * 8), 7)
            
        stage_info = STAGES[stage_idx]
        
        # Each captured frame is held for 15 frames (~0.5s) to produce a smooth, steady, digestible video pace
        hold_count = 15
        
        # Transition/crossfade if advancing to next captured frame
        composited = overlay_stage_hud(processed, stage_info, progress=progress)
        
        for _ in range(hold_count):
            out.write(composited)
            
        if (idx + 1) % 5 == 0 or idx == total_captured - 1:
            print(f"Rendered frame {idx + 1}/{total_captured} (Stage {stage_idx + 1}: {stage_info['title']})")
            
    print("3. Generating Outro Sequence...")
    outro_frames = create_outro_slide(duration_sec=3.5)
    for f in outro_frames:
        out.write(f)
        
    out.release()
    print(f"\nSUCCESS! Demo video rendered successfully to:\n{OUTPUT_VIDEO}")
    
    # Copy to artifact directory
    try:
        import shutil
        os.makedirs(os.path.dirname(ARTIFACT_VIDEO), exist_ok=True)
        shutil.copy2(OUTPUT_VIDEO, ARTIFACT_VIDEO)
        print(f"Copied artifact to: {ARTIFACT_VIDEO}")
    except Exception as e:
        print("Notice: Could not copy to artifact dir:", e)
        
    # Check file size & stats
    size_mb = os.path.getsize(OUTPUT_VIDEO) / (1024 * 1024)
    cap = cv2.VideoCapture(OUTPUT_VIDEO)
    total_vframes = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    v_fps = cap.get(cv2.CAP_PROP_FPS)
    duration_sec = total_vframes / v_fps if v_fps > 0 else 0
    cap.release()
    
    print(f"=== Video Statistics ===")
    print(f"File Size: {size_mb:.2f} MB")
    print(f"Resolution: {WIDTH}x{HEIGHT} (1080p)")
    print(f"Duration: {duration_sec:.1f} seconds ({total_vframes} frames @ {v_fps} FPS)")

if __name__ == "__main__":
    main()
