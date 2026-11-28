/* カラット: the bureau's seven people, for conversation practice (Japanese with furigana, English underneath).
   No votes, no economy: each one introduces themselves and makes small talk from a pool of their own lines. */
const L = (jp, en) => ({ jp, en });
export const CAST = {
  union: { j: '赤城 剛', r: 'あかぎ つよし', role: ['労働組合 委員長', 'Union negotiator'], fac: 'union', img: 'union', eye: '#FFB000', seat: true },
  civic: { j: '緑川 透', r: 'みどりかわ とおる', role: ['住民会議 代表', 'Residents envoy'], fac: 'res', img: 'res', eye: '#C6FF1A', seat: true },
  ops: { j: '黒田 迅', r: 'くろだ じん', role: ['運営部長', 'Operations director'], role3: ['運営・技術部長', 'Operations & engineering director'], fac: 'eng', img: 'eng', eye: '#FF3B30', seat: true },
  chair: { j: '九条 澪', r: 'くじょう みお', role: ['取締役会 議長', 'Board chair'], fac: 'board', img: 'board', eye: '#FFE600', seat: true },
  fin: { j: '銅島 恭介', r: 'どうじま きょうすけ', role: ['財務担当役員', 'Finance delegate'], fac: 'board', img: 'finance', eye: '#E08A3C', seat: true },
  legal: { j: '紫藤 綾', r: 'しどう あや', role: ['法務顧問', 'Legal counsel'], img: 'legal', eye: '#B48CFF' },
  audit: { j: '白銀 聡', r: 'しろがね さとし', role: ['監査委員', 'Audit commissioner'], img: 'audit', eye: '#DDE6F0' } };
export const ORDER = ['union', 'civic', 'ops', 'chair', 'fin', 'legal', 'audit'];
export const roleOf = k => CAST[k].role;
export const AUTH = {
  union: L('[組合|くみあい]は[出荷|しゅっか]の[許可|きょか]を止められる。[整備|せいび]も[俺|おれ]たちの仕事だ。', 'The union can stop outbound clearance. Maintenance is our work too.'),
  civic: L('[公聴会|こうちょうかい]を求めることができます。[住民|じゅうみん]の声は[記録|きろく]に[残|のこ]ります。', 'I can demand a public hearing. The residents\' voice goes on the record.'),
  ops: L('[電力|でんりょく]と[設備|せつび]の[判断|はんだん]は私がする。[危|あぶ]ない[計画|けいかく]には[反対|はんたい]する。', 'I rule on power and equipment. I oppose unsafe plans.'),
  chair: L('[採決|さいけつ]の[日程|にってい]は私が決めます。[全社|ぜんしゃ]の[方針|ほうしん]には、[取締役会|とりしまりやくかい]の[承認|しょうにん]が[必要|ひつよう]です。', 'I set the vote. Company-wide policy needs the board\'s approval.'),
  fin: L('[予備資金|よびしきん]を[割|わ]る[計画|けいかく]には[賛成|さんせい]できません。[数字|すうじ]を見せてください。', 'I can\'t back a plan that breaks the reserve. Show me the numbers.'),
  legal: L('私は[投票|とうひょう]しません。[約束|やくそく]が守れる[形|かたち]で書かれているかを[確|たし]かめます。', 'I don\'t vote. I check that a promise is written in a form that can be kept.'),
  audit: L('私も[投票|とうひょう]しません。[約束|やくそく]が[実際|じっさい]に[果|は]たされたかを[数|かぞ]えます。', 'I don\'t vote either. I count whether promises were actually kept.') };
export const CHAT = {
  union: [
    L('ロボットのせいで[仕事|しごと]がない[仲間|なかま]がいる。[研修|けんしゅう]をやってくれ。', 'Robots left some of our people idle. Run training.'),
    L('[残業|ざんぎょう]が[続|つづ]いて、みんな[疲|つか]れている。', 'The overtime goes on and everyone is tired.'),
    L('この[賃金|ちんぎん]では[暮|く]らせない。', 'Nobody can live on these wages.'),
    L('[今|いま]は[安全|あんぜん]が[一番|いちばん]の[問題|もんだい]だ。', 'Right now, safety is the main issue.'),
    L('[現場|げんば]はかなり[怒|おこ]っている。[次|つぎ]は[止|と]めるぞ。', 'The floor is angry. Next time we stop it.'),
    L('まあ、[普通|ふつう]だ。[油断|ゆだん]はするな。', 'So-so. Don\'t get comfortable.'),
    L('[最近|さいきん]は[悪|わる]くない。この[調子|ちょうし]で[頼|たの]む。', 'Not bad lately. Keep it up.')],
  civic: [
    L('[空気|くうき]が[汚|よご]れています。[子供|こども]たちが[咳|せき]をしています。', 'The air is dirty. The children are coughing.'),
    L('[街|まち]のカメラが[増|ふ]えて、みんな[不安|ふあん]です。', 'There are more cameras in the streets, and people are uneasy.'),
    L('[店|みせ]に[品物|しなもの]が[足|た]りません。', 'The shops are short of goods.'),
    L('[今|いま]は[落|お]ち[着|つ]いています。[情報|じょうほう]を[公開|こうかい]し[続|つづ]けてください。', 'It\'s calm for now. Keep publishing information.'),
    L('[住民|じゅうみん]の[怒|いか]りが[限界|げんかい]に[近|ちか]いです。', 'The residents\' anger is close to the limit.'),
    L('[住民|じゅうみん]は[様子|ようす]を見ています。', 'The residents are watching.'),
    L('[街|まち]の[雰囲気|ふんいき]はいいです。', 'The mood in town is good.')],
  ops: [
    L('[電力|でんりょく]が[足|た]りない。[停電|ていでん]で[生産|せいさん]が[落|お]ちている。', 'We are short of power. Brownouts are cutting production.'),
    L('[設備|せつび]はまだ[余|よ]っている。もっと[動|うご]かせる。', 'The equipment has room. We can run more.'),
    L('[技術者|ぎじゅつしゃ]には[研究|けんきゅう]の[時間|じかん]が[要|い]る。', 'The engineers need time for research.'),
    L('[現場|げんば]が[回|まわ]らない。[人|ひと]が[辞|や]めていく。', 'The floor can\'t keep up. People are quitting.'),
    L('[問題|もんだい]はない。[改善|かいぜん]の[余地|よち]はある。', 'No problems. Room to improve.'),
    L('[設備|せつび]は[好調|こうちょう]だ。', 'The equipment is running well.')],
  chair: [
    L('[借入|かりいれ]が[残|のこ]っています。[返済|へんさい]を[優先|ゆうせん]してください。', 'There is still debt. Repay it first.'),
    L('[安定度|あんていど]が[低|ひく]すぎます。[株主|かぶぬし]が[心配|しんぱい]しています。', 'Stability is too low. The shareholders are worried.'),
    L('[取締役会|とりしまりやくかい]の[監督|かんとく]を[忘|わす]れないでください。', 'Don\'t forget the board\'s oversight.'),
    L('[取締役会|とりしまりやくかい]は[不満|ふまん]です。[説明|せつめい]を求めます。', 'The board is unhappy. We want an explanation.'),
    L('[取締役会|とりしまりやくかい]は[静観|せいかん]しています。', 'The board is watching quietly.'),
    L('[取締役会|とりしまりやくかい]は[満足|まんぞく]しています。', 'The board is satisfied.')],
  fin: [
    L('[使|つか]える[現金|げんきん]がほとんどありません。', 'There is almost no spendable cash.'),
    L('[納期|のうき]を守ることが[信用|しんよう]になります。', 'Meeting delivery dates is what builds credit.'),
    L('[帳簿|ちょうぼ]は[赤|あか]です。', 'The books are in the red.'),
    L('[収支|しゅうし]は[安定|あんてい]しています。', 'Income and spending are steady.'),
    L('[利益|りえき]は[順調|じゅんちょう]です。', 'Profit is on track.')],
  legal: [
    L('[署名|しょめい]の[前|まえ]に、[期限|きげん]と[救済|きゅうさい]を[確認|かくにん]してください。', 'Before signing, check the deadline and the remedy.'),
    L('[記録|きろく]は[全部|ぜんぶ]見ています。[数字|すうじ]は[嘘|うそ]をつきません。', 'I see every record. Numbers don\'t lie.'),
    L('[訴訟|そしょう]の[準備|じゅんび]をしています。', 'I\'m preparing for litigation.'),
    L('[契約|けいやく]に[問題|もんだい]はありません。', 'No problems in the contracts.'),
    L('[全|すべ]て[法律|ほうりつ]の[範囲内|はんいない]です。', 'Everything is within the law.')],
  audit: [
    L('[記録|きろく]は[全部|ぜんぶ]見ています。[数字|すうじ]は[嘘|うそ]をつきません。', 'I see every record. Numbers don\'t lie.'),
    L('[記録|きろく]に[矛盾|むじゅん]があります。', 'There are contradictions in the records.'),
    L('[記録|きろく]を[確認|かくにん]しています。', 'I am checking the records.'),
    L('[記録|きろく]はきれいです。', 'The records are clean.')] };
