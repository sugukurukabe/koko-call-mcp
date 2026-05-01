# Demo Script

## 日本語

30秒デモの流れ:

1. MCPクライアントで `search_bids` を実行し、「鹿児島県の役務でシステム関連、直近公告」を検索する。
2. 返ってきた `Key` を使って `get_bid_detail` を実行する。
3. `bid://{bid_key}` Resource Templateで同じ案件を参照する。
4. 最後に `attribution` が出力に含まれていることを見せる。

## English

30-second demo flow:

1. Run `search_bids` for recent system-related service bids in Kagoshima.
2. Use the returned `Key` with `get_bid_detail`.
3. Read the same bid through the `bid://{bid_key}` Resource Template.
4. Show that `attribution` is included in the output.

## Bahasa Indonesia

Alur demo 30 detik:

1. Jalankan `search_bids` untuk tender layanan terkait sistem di Kagoshima.
2. Gunakan `Key` yang dikembalikan dengan `get_bid_detail`.
3. Baca tender yang sama melalui Resource Template `bid://{bid_key}`.
4. Tunjukkan bahwa `attribution` selalu ada di output.
