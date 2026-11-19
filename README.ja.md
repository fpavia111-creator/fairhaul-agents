# Fairhaul 物流エージェント

*Claude による翻訳で、ネイティブによる確認は未実施です。英語の [README](README.md) が正本です。*

運賃・配送コストのための 30 の小さな MCP エージェントです。それぞれが **一つの業務** だけを担当します。運賃請求書の監査、月末の運賃未払計上、運送会社への支払精算、輸入申告の確認などで、その外では動けません。TMS、ERP、WMS、運送会社のポータル、EDI プロバイダーからすでにエクスポートしているファイルを読み、お客様のコンピューター上にレポートを書き出し、お金の移動、メッセージの送信、本番システムの変更の前には指名された担当者を待ちます。

MIT ライセンス · Node 20 以降 · ローカルファイルのみ · 認証情報不要 · 依存パッケージなし

## 試す

```bash
npx -y fairhaul-freight-bill-audit demo        # 架空データでの運賃請求監査
npx -y fairhaul-freight-accruals demo     # 架空データでの運賃未払計上
```

各エージェントには架空のファイルで動く `demo`、自身のテストケースで確認する `eval`、Claude Desktop、Claude Code、Cursor などの MCP ホスト向けの MCP サーバー (`npx -y <agent> mcp --root <フォルダー>`) があります。現時点では、列名とレポートは英語です。

## エージェント一覧

**運送会社の請求:** `fairhaul-freight-bill-audit` (貸切・混載の請求と契約の照合)、`fairhaul-parcel-refunds` (宅配便)、`fairhaul-detention-and-lumper` (待機料金)、`fairhaul-fuel-surcharges` (燃料サーチャージ)、`fairhaul-accessorial-charges` (付帯料金の発生源)、`fairhaul-ltl-reweighs` (再計量と等級変更)、`fairhaul-duplicate-payments` (二重払い)、`fairhaul-ocean-freight-audit` (海上輸送)、`fairhaul-air-freight-audit` (航空輸送)、`fairhaul-proof-of-delivery` (配達証明)、`fairhaul-container-demurrage` (コンテナのフリータイムとデマレージ)、`fairhaul-customs-entries` (輸入申告と商業インボイスの照合、関税分類の助言なし)。

**計画・調達・運用:** `fairhaul-rfp-bid-scoring` (入札)、`fairhaul-contract-rerating` (各契約での過去実績の再計算)、`fairhaul-spot-quotes` (スポット見積)、`fairhaul-lane-spend` (レーン別支出と混載)、`fairhaul-carrier-scorecards` (運送会社スコアカード)、`fairhaul-carrier-vetting` (不正の兆候)、`fairhaul-load-tracking` (遅延貨物)、`fairhaul-dock-scheduling` (荷受けバースの予約)、`fairhaul-carton-sizing` (箱のサイズ)、`fairhaul-edi-files` (X12 ファイルの読み取りと照合)。

**決算とコスト:** `fairhaul-freight-accruals` (運賃未払計上)、`fairhaul-freight-allocation` (受注・コストセンター別の運賃配賦)、`fairhaul-standard-freight-cost` (品目原価の運賃標準)、`fairhaul-freight-margins` (顧客別の請求運賃と実運賃)、`fairhaul-broker-settlements` (ブローカー向け運送会社支払)、`fairhaul-freight-claims` (貨物事故の請求)、`fairhaul-returns-tracking` (返品から返金まで)、`fairhaul-freight-emissions` (お客様が選んだ係数による排出量の見積)。

## 安全のしくみ

- **エージェントごとの許可リスト。** 各エージェントは自分のツールしか呼べません。
- **拒否するツール。** 支払、メール送信、TMS の変更、総勘定元帳への計上、税関への申告は名前を挙げて禁止しています。
- **指名された担当者の 1 クリック。** 支払、送信、本番変更、仕訳の承認は、Auto モードでも指名された担当者を待ちます。承認は確認した下書きの sha256 に結び付きます。
- **監査ログ** は `.fairhaul/` にハッシュ連鎖で記録され、Ed25519 鍵を設定すれば署名されます。
- **緊急停止:** `<agent> kill` で `<agent> unkill` まですべてのツールを止めます。

## テストのしくみ

各エージェントには、自分のルールに対する個別のテスト、全エージェント共通の契約テスト（引数、`--root` の外のファイル、レビューモード、停止スイッチ、下書きの承認、再現性のある結果）、架空のファイルによる 14〜22 件の評価ケースがあります。表を読むケースはすべて、ドイツ・フランス・スペイン・ブラジル・イタリア・日本・中国・韓国のエクスポート形式でも実行し、各エージェントのファイルには悪意あるデータも仕込んでいます。合計 915 件のテストと 520 件の評価ケースが Node 20、22、24 で合格しています。バージョン 2 の変更点と見つかったバグは [REVIEW-ver3.md](REVIEW-ver3.md)（英語）にあります。

## 制限

- 各エージェントは渡されたファイルだけで動き、運送会社、TMS、ERP、銀行、行政のシステムにはログインしません。
- 法律・税務・通関・会計の助言ではありません。判断と実行は人が行います。
