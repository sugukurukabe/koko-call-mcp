# Demo GIF 作成ガイド / Demo GIF Creation Guide / Panduan Membuat Demo GIF

## 目的 / Purpose / Tujuan

Public MCP JP Gateway の価値を 30 秒で視覚的に伝えるデモ GIF を作成する。
Create a demo GIF that visually conveys the value of Public MCP JP Gateway in 30 seconds.
Membuat GIF demo yang menyampaikan nilai Public MCP JP Gateway secara visual dalam 30 detik.

## 推奨ユースケース / Recommended Use Cases / Kasus Penggunaan yang Direkomendasikan

1. **不動産投資分析** (real_estate_assessment)
   - 東京都新宿区の地価トレンド・災害リスクを分析
   - 投資判断の材料をまとめる

2. **入札＋補助金の一気通貫** (search_public_opportunities)
   - 鹿児島県の IT 関連入札を探す
   - 使える DX 補助金も同時に確認

3. **資金繰り確認** (financial_health_check)
   - MoneyForward の試算表を確認
   - 今月の資金繰りに問題がないかチェック

## 作成手順 / Creation Steps / Langkah-langkah Pembuatan

### 1. 画面録画 / Screen Recording / Rekaman Layar

**ツール / Tools / Alat:**
- macOS: QuickTime Player / Keynote
- Windows: OBS Studio / Xbox Game Bar
- Linux: OBS Studio / SimpleScreenRecorder

**設定 / Settings / Pengaturan:**
- 解像度: 1920x1080 または 1280x720
- フレームレート: 30fps
- 音声: マイク + システム音声 (オプション)

### 2. 編集 / Editing / Penyuntingan

**ツール / Tools / Alat:**
- ffmpeg (コマンドライン)
- DaVinci Resolve (無料)
- CapCut (モバイル/デスクトップ)

**30秒にカット / Trim to 30 seconds / Potong menjadi 30 detik:**

```bash
ffmpeg -i input.mov -t 30 -c:v libx264 -crf 23 -c:a aac output.mp4
```

### 3. GIF 変換 / GIF Conversion / Konversi ke GIF

**ffmpeg で GIF 変換 / Convert to GIF with ffmpeg / Konversi ke GIF dengan ffmpeg:**

```bash
ffmpeg -i output.mp4 \
  -vf "fps=15,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -loop 0 \
  demo.gif
```

**パラメータの説明 / Parameter explanation / Penjelasan parameter:**
- `fps=15`: 15フレーム/秒 (ファイルサイズ削減)
- `scale=800:-1`: 幅 800px にリサイズ (高さはアスペクト比維持)
- `loop 0`: 無限ループ

### 4. 最適化 / Optimization / Optimasi

**gifsicle で最適化 / Optimize with gifsicle / Optimasi dengan gifsicle:**

```bash
gifsicle -O3 --lossy=30 demo.gif -o demo-optimized.gif
```

### 5. README への埋め込み / Embedding in README / Menyisipkan di README

```markdown
![Demo](demo.gif)
```

## 推奨スペック / Recommended Specifications / Spesifikasi yang Direkomendasikan

| 項目 / Item / Item | 推奨値 / Recommended / Nilai yang Direkomendasikan |
|---|---|
| 解像度 / Resolution / Resolusi | 800x450 (16:9) |
| フレームレート / Frame rate / Frame rate | 15fps |
| 長さ / Duration / Durasi | 30秒 |
| ファイルサイズ / File size / Ukuran file | < 5MB |
| 形式 / Format / Format | GIF (ループ) |

## 注意事項 / Notes / Catatan

- **テキストは最小限に**: 視覚的に伝えることを優先
- **日本語・英語・インドネシア語の字幕**: 3言語で表示 (オプション)
- **X/Twitter 投稿用**: 1:1 アスペクト比版も作成 (1080x1080)
- **自動生成**: 将来的に GitHub Actions で自動生成 (予定)

## 参考リンク / Reference Links / Tautan Referensi

- [ffmpeg Documentation](https://ffmpeg.org/documentation.html)
- [gifsicle Documentation](https://www.lcdf.org/gifsicle/)
- [OBS Studio](https://obsproject.com/)

---

*このガイドは Public MCP JP Gateway のマーケティング資料作成用です。*
*This guide is for creating marketing materials for Public MCP JP Gateway.*
*Panduan ini untuk membuat materi pemasaran Public MCP JP Gateway.*