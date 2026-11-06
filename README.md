# ClassSpin 🎡
### Spin • Learn • Have Fun!
Ultra-Fast Interactive Classroom Spinning Wheel for Teachers

---

## 1. Project Overview

**ClassSpin** is a modern, web-based classroom spinning wheel application designed specifically for 1st Standard classroom activities, random student selection, quizzes, games, rewards, and interactive learning.

### Key Highlights
- **High Performance:** Smooth 60 FPS rotation powered by HTML5 Canvas and GPU-accelerated transforms. Zero animation stutter.
- **Fair & Accurate:** Pre-calculated, cryptographically uniform random selection (supports weighted probabilities). The pointer always stops precisely on the selected partition.
- **Child-Friendly & Colourful:** 7 vibrant classroom themes (Rainbow, Pastel, Ocean, Candy, Space, Classroom, Custom) with automatic contrast calculations for optimal readability.
- **Fully Customizable:** Configure 2 to 100 partitions, custom segment text/subtitles, image uploads, easing curves, stopping behaviour, and audio effects.
- **Projector & Smart TV Ready:** Native Fullscreen API integration with responsive scaling across laptops, tablets, interactive whiteboards, and 55–75" Smart TVs.
- **100% Offline & Local:** Built entirely without backend servers or paid hosting. Stores configurations, presets, and images locally in IndexedDB and preferences in localStorage. Includes a service worker for offline loading.
- **Deployable via GitHub Pages:** Includes a GitHub Actions automated workflow.

---

## 2. Technology Stack

- **Framework:** React 19 with TypeScript
- **Bundler & Build Tool:** Vite
- **Styling:** Modern CSS with CSS variables, responsive design, and CSS Grid/Flexbox
- **Wheel Rendering:** HTML5 Canvas (rendered once, rotated via hardware-accelerated 3D CSS transforms)
- **Sound Effects:** Synthesized Web Audio API (zero audio files needed, works offline)
- **Particles:** Lightweight custom canvas particle system (confetti, fireworks, stars, sparkles)
- **Icons:** Lucide React
- **Persistence:** IndexedDB (for wheels, image blobs, drafts) & localStorage (for preferences)
- **Testing:** Vitest

---

## 3. Installation & Development

### Prerequisites
- Node.js 18+ (tested with Node.js 22 & 24)
- npm 9+

### Commands

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Run unit tests
npm test

# 4. Typecheck and build production bundle
npm run build

# 5. Preview production build locally
npm run preview
```

---

## 4. How to Use ClassSpin

### 4.1 Main Wheel Screen
1. Click **SPIN!** (or press the **Spacebar**).
2. The wheel rotates smoothly for the configured duration and stops exactly at the winning segment.
3. The winner card pops up with celebratory particles (confetti, stars, fireworks) and sound.
4. Click **SPIN AGAIN** or **NEXT SELECTION** (which temporarily excludes the winner to prevent repeats in the same round).
5. Press **M** to toggle sound; press **Esc** or click the Full Screen button to toggle projector mode.

### 4.2 Keyboard Shortcuts
- `Spacebar`: Spin the wheel (or stop a free spin in manual mode)
- `R`: Spin again (when idle)
- `M`: Toggle audio mute
- `Esc`: Close the result popup or exit full-screen mode

### 4.3 Configuring Wheel Segments & Images
1. Click **Settings** from the top bar.
2. Go to **Segments** to add, remove, reorder, duplicate, rename, or color-code individual partitions.
3. Go to **Images** to upload photos or graphics for any segment:
   - Supports **JPG**, **PNG**, **WebP**, and **SVG** up to 10 MB.
   - Choose layout: *Text only*, *Image only*, *Image above text*, *Image below text*, *Image beside text*, or *Icon with text*.
   - Images are downscaled, sanitized, and stored locally in **IndexedDB**. They stay available after browser refreshes.

### 4.4 Saving, Presets, and Backups
- Go to **Presets** to load pre-built classroom wheels (*Student Names*, *English Questions*, *Mathematics*, *Science Quiz*, *Rewards*, *Classroom Activities*).
- Click **Backup All** to export all your wheels (with embedded images) as a single `.json` file.
- Click **Import JSON** on any computer to restore or add saved wheels.

---

## 5. GitHub Pages Deployment

The repository includes a ready-to-run GitHub Actions workflow in `.github/workflows/deploy.yml`.

### Deployment Steps:
1. Push your repository to GitHub on branch `main`.
2. In your GitHub repository:
   - Go to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Push a commit or trigger the workflow manually under **Actions**. The site will build, run unit tests, and deploy to GitHub Pages automatically.

---

## 6. License

MIT License. Built for teachers, educators, and students.
