import { useState, useEffect, useRef, useCallback } from "react";

/*
  Each section is a block of prose with {variable_id} tokens embedded.
  Variables carry metadata: prior value, source, task type, guidance.
  In EDIT mode, variables render as highlighted inline spans the user can click to edit.
  In PREVIEW mode, the section renders clean with a redline diff below.
*/

const VARS = {
  supp_num:   { prior:"Eleventh Supplemental Indenture", src:"counsel", task:"update", hint:"Increment to next number", suggest:"Twelfth Supplemental Indenture" },
  supp_label: { prior:"Eleventh", src:"counsel", task:"update", hint:"Ordinal only", suggest:"Twelfth" },
  mkts:       { prior:"88 markets", src:"client", task:"update", hint:"Current market count (was 84→86→88)" },
  brands:     { prior:"Teavana®, Ethos® and Starbucks Reserve®", src:"client", task:"verify", hint:"Princi® dropped in 2025" },
  asof:       { prior:"March 30, 2025", src:"auto", task:"update", hint:"Most recent fiscal quarter-end", autoSrc:"SEC EDGAR — most recent 10-Q" },
  sr_notes:   { prior:"$15,700.0 million", src:"auto", task:"update", hint:"Aggregate principal amount", autoSrc:"SEC EDGAR — 10-Q, Long-Term Debt footnote" },
  sub_debt:   { prior:"$1.1 million", src:"auto", task:"update", hint:"Excl. trade payables; was $0→$49.5M→$1.1M", autoSrc:"SEC EDGAR — 10-Q, Subsidiary debt" },
  total_liab: { prior:"$39,248.5 million", src:"auto", task:"update", hint:"Consolidated total liabilities", autoSrc:"SEC EDGAR — 10-Q, Balance Sheet" },
  mature:     { prior:"$1.25 billion in aggregate principal amount of our 3.800% Senior Notes maturing on August 15, 2025", src:"client", task:"update", hint:"Which maturities to refinance" },
  cp_out:     { prior:"no outstanding borrowings under our commercial paper program", src:"auto", task:"update", hint:"Was $0, then $300M, then $0 across deals", autoSrc:"SEC EDGAR — 10-Q, Short-Term Borrowings" },
  cred_out:   { prior:"no amounts of outstanding borrowings under our Credit Agreement", src:"auto", task:"update", autoSrc:"SEC EDGAR — 10-Q, Credit Facility" },
  cred_terms: { prior:"$3.0 billion unsecured, revolving credit facility (of which $150 million may be used for the issuances of letters of credit) and is scheduled to mature on September 16, 2026", src:"auto", task:"update", hint:"Verify terms, amendments, maturity", autoSrc:"SEC EDGAR — 10-Q + 8-K amendments" },
  cred_amend: { prior:"most recently amended in April 2023", src:"auto", task:"update", autoSrc:"SEC EDGAR — 8-K filings" },
  bookrunners:{ prior:"BofA Securities, Citigroup, Morgan Stanley, Scotiabank, US Bancorp, Wells Fargo Securities", src:"underwriter", task:"update", hint:"New syndicate and billing order" },
  conflicts:  { prior:"our 3.800% Senior Notes, which we intend to repay in full at maturity with a portion of the net proceeds of this offering", src:"counsel", task:"update", hint:"Update for new maturing notes" },
  ratings_m:  { prior:"Baa3", src:"auto", task:"verify", autoSrc:"Moody's Investors Service — current rating" },
  ratings_s:  { prior:"BBB-", src:"auto", task:"verify", autoSrc:"S&P Global Ratings — current rating" },
  trustee:    { prior:"U.S. Bank Trust Company, National Association", src:"counsel", task:"verify" },
  notes_table:{ prior:"20 series totaling $15,700.0 million", src:"auto", task:"update", autoSrc:"SEC EDGAR — 10-Q, Long-Term Debt schedule" },
  notes_foot: { prior:'Does not give effect to the issuance of the Notes in this offering or repayment of the 3.800% Senior Notes at the closing of this offering', src:"counsel", task:"update", hint:"Update for new deal" },
  rf_new:     { prior:"[none — no new factors added in prior deal]", src:"counsel", task:"update", hint:"Assess current conditions" },
  rf_remove:  { prior:"[COVID-19 factor was removed in Feb 2024 filing]", src:"counsel", task:"verify", hint:"Flag stale factors" },
  cap_style:  { prior:'capitalized "Notes" and "Indenture"', src:"counsel", task:"verify", hint:'Was lowercase in 2023-24, capitalized in 2025' },
  cov_lang:   { prior:"unchanged across all three prior deals", src:"counsel", task:"verify", hint:"Highly stable; confirm no updates" },
  tax_lang:   { prior:"FATCA references proposed Treasury Regs on gross proceeds withholding (added 2025). Backup withholding at 24%.", src:"counsel", task:"verify", hint:"Check for tax law changes" },
  incorp:     { prior:"Most recent 10-K, subsequent 10-Qs, relevant 8-Ks since last offering", src:"auto", task:"update", autoSrc:"SEC EDGAR — all filings CIK 829224 since May 2025" },
};

const SECTIONS = [
  { key:"indenture", title:"Description of Notes — Indenture",
    text:`The Notes will be issued under and governed by an indenture dated as of September 15, 2016 (the "2016 Base Indenture") between us and {trustee}, as trustee (the "Trustee"), as successor in interest to U.S. Bank National Association, as supplemented by a supplemental indenture to be entered into between us and the Trustee on the date of issue of the Notes, with respect to the Notes (the "{supp_label} Supplemental Indenture" and, together with the 2016 Base Indenture, the "Indenture").` },
  { key:"company", title:"Company Description",
    text:`Starbucks is the premier roaster, marketer and retailer of specialty coffee in the world, operating in {mkts}. Formed in 1985, Starbucks Corporation's common stock trades on the Nasdaq Global Select Market ("Nasdaq") under the symbol "SBUX." In addition to our flagship Starbucks Coffee® brand, we sell goods and services under the following brands: {brands}.` },
  { key:"ranking", title:"Ranking",
    text:`The Notes will rank equally in right of payment with all of our other senior unsecured indebtedness, whether currently existing or incurred in the future. As of {asof}, we had {sr_notes} in aggregate principal amount of senior unsecured Notes outstanding and a $3.0 billion unsecured, revolving Credit Agreement, with no amounts outstanding. The Notes will be senior in right of payment to our subordinated indebtedness and effectively junior in right of payment to our secured indebtedness to the extent of the value of the collateral securing such indebtedness. The Notes will be effectively subordinated to any existing or future indebtedness or other liabilities, including trade payables, of any of our subsidiaries. As of {asof}, our subsidiaries had {sub_debt} in outstanding indebtedness (excluding trade payables).` },
  { key:"redemption", title:"Redemption — Make-Whole & Par Call",
    text:`At any time prior to the applicable Par Call Date, the Notes of the applicable series will be redeemable at a redemption price equal to the greater of 100% of the aggregate principal amount or the sum of present values discounted at the Treasury Rate plus [___] basis points in the case of the first tranche, plus [___] basis points in the case of the second tranche, or plus [___] basis points in the case of the third tranche. "Par Call Date" means, in the case of each tranche, the date that is [___], [___], and [___] months, respectively, prior to the applicable maturity date. [Note: Make-whole spreads, par call dates, and other deal-specific terms to be set at pricing.]` },
  { key:"proceeds", title:"Use of Proceeds",
    text:`We estimate the net proceeds from the sale of the Notes offered hereby will be approximately $[___] million after deduction of the underwriting discounts and offering expenses. We intend to use the net proceeds from the sale of the Notes to repay at maturity all of the {mature}, and for general corporate purposes. We may temporarily invest funds that are not immediately needed for these purposes in short-term investments, including marketable securities.` },
  { key:"risk_leverage", title:"Risk Factors — Increased Leverage",
    text:`As of {asof}, we had approximately {total_liab} of total liabilities on a consolidated basis, including {sr_notes} in aggregate principal amount of senior unsecured notes outstanding. Our commercial paper program currently has a borrowing limit of $3.0 billion, which is backstopped by our revolving Credit Agreement. The current commitment under our Credit Agreement is $3.0 billion, which may be increased to $4.0 billion. As of {asof}, we had {cp_out} and {cred_out}.` },
  { key:"risk_updates", title:"Risk Factors — Review & Updates",
    text:`New risk factors to evaluate: {rf_new}. Risk factors to consider removing: {rf_remove}. All embedded financial figures must be updated to the {asof} as-of date to match the Financial Data section.` },
  { key:"credit", title:"Description of Certain Other Indebtedness",
    text:`Our credit agreement provides for a {cred_terms}. As of {asof}, we had no outstanding borrowings under the Credit Agreement. Borrowings under the credit facility, which was {cred_amend}, will bear interest at a variable rate based on Term SOFR plus an applicable margin.` },
  { key:"notes_sched", title:"Outstanding Notes Schedule",
    text:`As of {asof}, we had an aggregate principal amount of {sr_notes} of senior unsecured notes outstanding. The specific outstanding principal amounts, maturities and interest rates are set forth in the table. {notes_table}. Footnote: {notes_foot}.` },
  { key:"underwriting", title:"Underwriting (Conflicts of Interest)",
    text:`Joint Book-Running Managers: {bookrunners}. Certain of the underwriters or their respective affiliates may be holders of {conflicts}. Accordingly, such underwriters or their respective affiliates may receive more than 5% of the net proceeds of this offering, not including underwriting compensation, thus creating a "conflict of interest" within the meaning of FINRA Rule 5121.` },
  { key:"tax", title:"Tax & Legal Boilerplate",
    text:`Investment Grade Rating means a rating equal to or higher than {ratings_m} (or the equivalent) by Moody's and {ratings_s} (or the equivalent) by S&P. The Trustee is {trustee}. Tax section status: {tax_lang}. Capitalization convention: {cap_style}. Covenant language: {cov_lang}. Documents incorporated by reference: {incorp}.` },
  { key:"settlement", title:"Settlement & Delivery",
    text:`Delivery of the Notes will be made on or about T+[___] business days following the date of this prospectus supplement. Under Rule 15c6-1 under the Exchange Act, trades in the secondary market are required to settle in one business day, unless the parties to any such trade expressly agree otherwise. [Note: Settlement day count to be confirmed by underwriters.]` },
];

const SRC = {
  auto:       {c:"#2563EB",bg:"#DBEAFE",lb:"Auto",  ring:"#93C5FD"},
  counsel:    {c:"#B45309",bg:"#FEF3C7",lb:"Counsel",ring:"#FCD34D"},
  client:     {c:"#047857",bg:"#D1FAE5",lb:"Client", ring:"#6EE7B7"},
  underwriter:{c:"#7C3AED",bg:"#EDE9FE",lb:"Banks",  ring:"#C4B5FD"},
  termsheet:  {c:"#DC2626",bg:"#FEF2F2",lb:"Term Sheet",ring:"#FCA5A5"},
};

/* ── Term sheet data (from the Starbucks May 6, 2025 pricing term sheet) ── */
const TERM_SHEET = {
  deal_size: "$1,750,000,000",
  trade_date: "May 6, 2025",
  settlement_date: "May 8, 2025",
  settlement_t: "2",
  ratings: "Baa1 (Negative Outlook) / BBB+ (Negative Outlook)",
  bookrunners: "BofA Securities, Inc., Citigroup Global Markets Inc., Morgan Stanley & Co. LLC, Scotia Capital (USA) Inc., U.S. Bancorp Investments, Inc., Wells Fargo Securities, LLC",
  co_managers: "Academy Securities, Blaylock Van, LLC, Fifth Third Securities, Goldman Sachs & Co. LLC, HSBC Securities (USA) Inc., ICBC Standard Bank Plc, J.P. Morgan Securities LLC, Loop Capital Markets LLC, Rabo Securities USA, Inc., Standard Chartered Bank, Truist Securities",
  net_proceeds: "1.74 billion",
  tranches: [
    { name:"2028 Notes", coupon:"4.500%", principal:"$750,000,000", maturity:"May 15, 2028", par_call:"April 15, 2028", par_call_months:"one month", mw_bps:"15", price:"99.873%", discount:"0.250%", cusip:"855244BN8 / US855244BN88", benchmark:"UST 3.750% due April 15, 2028", spread:"+77 bps", ytm:"4.545%" },
    { name:"2030 Notes", coupon:"4.800%", principal:"$500,000,000", maturity:"May 15, 2030", par_call:"April 15, 2030", par_call_months:"one month", mw_bps:"15", price:"99.981%", discount:"0.350%", cusip:"855244BL2 / US855244BL23", benchmark:"UST 3.875% due April 30, 2030", spread:"+90 bps", ytm:"4.804%" },
    { name:"2035 Notes", coupon:"5.400%", principal:"$500,000,000", maturity:"May 15, 2035", par_call:"February 15, 2035", par_call_months:"three months", mw_bps:"20", price:"99.907%", discount:"0.450%", cusip:"855244BM0 / US855244BM06", benchmark:"UST 4.625% due February 15, 2035", spread:"+110 bps", ytm:"5.412%" },
  ],
  interest_dates: "May 15 and November 15, beginning November 15, 2025",
  record_dates: "May 1 and November 1",
  accrual_date: "May 8, 2025",
};

const TS_FIELDS = [
  { id:"deal_size", label:"Total Deal Size", val: TERM_SHEET.deal_size, section:"cover" },
  { id:"settlement", label:"Settlement", val:`T+${TERM_SHEET.settlement_t} (${TERM_SHEET.settlement_date})`, section:"settlement" },
  { id:"ratings", label:"Ratings", val: TERM_SHEET.ratings, section:"tax" },
  { id:"bookrunners", label:"Book-Runners", val: TERM_SHEET.bookrunners, section:"underwriting" },
  { id:"co_managers", label:"Co-Managers", val: TERM_SHEET.co_managers, section:"underwriting" },
  { id:"net_proceeds", label:"Net Proceeds", val:`~$${TERM_SHEET.net_proceeds}`, section:"proceeds" },
  { id:"interest", label:"Interest Payment Dates", val: TERM_SHEET.interest_dates, section:"indenture" },
  ...TERM_SHEET.tranches.flatMap((t,i) => [
    { id:`t${i}_principal`, label:`${t.name} — Principal`, val:t.principal, section:"cover" },
    { id:`t${i}_coupon`, label:`${t.name} — Coupon`, val:t.coupon, section:"cover" },
    { id:`t${i}_maturity`, label:`${t.name} — Maturity`, val:t.maturity, section:"cover" },
    { id:`t${i}_parcall`, label:`${t.name} — Par Call`, val:`${t.par_call} (${t.par_call_months} prior)`, section:"redemption" },
    { id:`t${i}_mwbps`, label:`${t.name} — Make-Whole`, val:`+${t.mw_bps} bps`, section:"redemption" },
    { id:`t${i}_price`, label:`${t.name} — Issue Price`, val:t.price, section:"cover" },
    { id:`t${i}_discount`, label:`${t.name} — UW Discount`, val:t.discount, section:"underwriting" },
    { id:`t${i}_cusip`, label:`${t.name} — CUSIP/ISIN`, val:t.cusip, section:"cover" },
  ]),
];

/* Sections rewritten with term sheet data filled in */
const FINAL_SECTIONS = [
  { key:"indenture", title:"Description of Notes — Indenture",
    text:`The Notes will be issued under and governed by an indenture dated as of September 15, 2016 (the "2016 Base Indenture") between us and {trustee}, as trustee (the "Trustee"), as successor in interest to U.S. Bank National Association, as supplemented by a supplemental indenture to be entered into between us and the Trustee on the date of issue of the Notes, with respect to the Notes (the "{supp_label} Supplemental Indenture" and, together with the 2016 Base Indenture, the "Indenture"). The aggregate principal amount of the 2028 Notes will initially be $750,000,000, and the 2028 Notes will mature on May 15, 2028. The aggregate principal amount of the 2030 Notes will initially be $500,000,000, and the 2030 Notes will mature on May 15, 2030. The aggregate principal amount of the 2035 Notes will initially be $500,000,000, and the 2035 Notes will mature on May 15, 2035. The 2028 Notes will bear interest at a fixed rate of 4.500% per annum, the 2030 Notes will bear interest at a fixed rate of 4.800% per annum, and the 2035 Notes will bear interest at a fixed rate of 5.400% per annum, each starting on May 8, 2025. Interest on the Notes will be payable semiannually in arrears on May 15 and November 15 of each year, beginning on November 15, 2025.` },
  { key:"company", title:"Company Description",
    text:`Starbucks is the premier roaster, marketer and retailer of specialty coffee in the world, operating in {mkts}. Formed in 1985, Starbucks Corporation's common stock trades on the Nasdaq Global Select Market ("Nasdaq") under the symbol "SBUX." In addition to our flagship Starbucks Coffee® brand, we sell goods and services under the following brands: {brands}.` },
  { key:"ranking", title:"Ranking",
    text:`The Notes will rank equally in right of payment with all of our other senior unsecured indebtedness, whether currently existing or incurred in the future. As of {asof}, we had {sr_notes} in aggregate principal amount of senior unsecured Notes outstanding and a $3.0 billion unsecured, revolving Credit Agreement, with no amounts outstanding. The Notes will be senior in right of payment to our subordinated indebtedness and effectively junior in right of payment to our secured indebtedness to the extent of the value of the collateral securing such indebtedness. The Notes will be effectively subordinated to any existing or future indebtedness or other liabilities, including trade payables, of any of our subsidiaries. As of {asof}, our subsidiaries had {sub_debt} in outstanding indebtedness (excluding trade payables).` },
  { key:"redemption", title:"Redemption — Make-Whole & Par Call",
    text:`At any time prior to the applicable Par Call Date, the Notes of the applicable series will be redeemable at a redemption price equal to the greater of 100% of the aggregate principal amount or the sum of present values discounted at the Treasury Rate plus 15 basis points in the case of the 2028 Notes, plus 15 basis points in the case of the 2030 Notes, or plus 20 basis points in the case of the 2035 Notes. "Par Call Date" means, in the case of the 2028 Notes, April 15, 2028 (one month prior to the maturity date of the 2028 Notes), in the case of the 2030 Notes, April 15, 2030 (one month prior to the maturity date of the 2030 Notes) and, in the case of the 2035 Notes, February 15, 2035 (three months prior to the maturity date of the 2035 Notes).` },
  { key:"proceeds", title:"Use of Proceeds",
    text:`We estimate the net proceeds from the sale of the Notes offered hereby will be approximately $1.74 billion after deduction of the underwriting discounts and offering expenses. We intend to use the net proceeds from the sale of the Notes to repay at maturity all of the {mature}, and for general corporate purposes. We may temporarily invest funds that are not immediately needed for these purposes in short-term investments, including marketable securities.` },
  { key:"risk_leverage", title:"Risk Factors — Increased Leverage",
    text:`As of {asof}, we had approximately {total_liab} of total liabilities on a consolidated basis, including {sr_notes} in aggregate principal amount of senior unsecured notes outstanding. Our commercial paper program currently has a borrowing limit of $3.0 billion, which is backstopped by our revolving Credit Agreement. The current commitment under our Credit Agreement is $3.0 billion, which may be increased to $4.0 billion. As of {asof}, we had {cp_out} and {cred_out}.` },
  { key:"risk_updates", title:"Risk Factors — Review & Updates",
    text:`New risk factors to evaluate: {rf_new}. Risk factors to consider removing: {rf_remove}. All embedded financial figures must be updated to the {asof} as-of date to match the Financial Data section.` },
  { key:"credit", title:"Description of Certain Other Indebtedness",
    text:`Our credit agreement provides for a {cred_terms}. As of {asof}, we had no outstanding borrowings under the Credit Agreement. Borrowings under the credit facility, which was {cred_amend}, will bear interest at a variable rate based on Term SOFR plus an applicable margin.` },
  { key:"notes_sched", title:"Outstanding Notes Schedule",
    text:`As of {asof}, we had an aggregate principal amount of {sr_notes} of senior unsecured notes outstanding. The specific outstanding principal amounts, maturities and interest rates are set forth in the table. {notes_table}. Footnote: {notes_foot}.` },
  { key:"underwriting", title:"Underwriting (Conflicts of Interest)",
    text:`Joint Book-Running Managers: BofA Securities, Inc., Citigroup Global Markets Inc., Morgan Stanley & Co. LLC, Scotia Capital (USA) Inc., U.S. Bancorp Investments, Inc., Wells Fargo Securities, LLC. Co-Managers: Academy Securities, Blaylock Van, LLC, Fifth Third Securities, Goldman Sachs & Co. LLC, HSBC Securities (USA) Inc., ICBC Standard Bank Plc, J.P. Morgan Securities LLC, Loop Capital Markets LLC, Rabo Securities USA, Inc., Standard Chartered Bank, Truist Securities. Certain of the underwriters or their respective affiliates may be holders of {conflicts}. Accordingly, such underwriters or their respective affiliates may receive more than 5% of the net proceeds of this offering, not including underwriting compensation, thus creating a "conflict of interest" within the meaning of FINRA Rule 5121.` },
  { key:"tax", title:"Tax & Legal Boilerplate",
    text:`Investment Grade Rating means a rating equal to or higher than Baa1 (or the equivalent) by Moody's and BBB+ (or the equivalent) by S&P. The Trustee is {trustee}. Tax section status: {tax_lang}. Capitalization convention: {cap_style}. Covenant language: {cov_lang}. Documents incorporated by reference: {incorp}.` },
  { key:"settlement", title:"Settlement & Delivery",
    text:`Delivery of the Notes will be made on or about T+2 business days following the date of this prospectus supplement, which is expected to be May 8, 2025. Under Rule 15c6-1 under the Exchange Act, trades in the secondary market are required to settle in one business day, unless the parties to any such trade expressly agree otherwise. Accordingly, purchasers who wish to trade the Notes prior to the first business day prior to the settlement date will be required, by virtue of the fact that the Notes initially will settle in T+2, to specify an alternative settlement cycle at the time of any such trade to prevent failed settlement.` },
];

/* ── Word diff (LCS) ── */
function wdiff(a,b){
  if(a===b)return[{t:0,w:a}];
  const A=a.split(/(\s+)/),B=b.split(/(\s+)/),m=A.length,n=B.length;
  const dp=Array.from({length:m+1},()=>new Uint16Array(n+1));
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=A[i-1]===B[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  const r=[];let i=m,j=n;
  while(i>0||j>0){if(i>0&&j>0&&A[i-1]===B[j-1]){r.push({t:0,w:A[i-1]});i--;j--;}
  else if(j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])){r.push({t:1,w:B[j-1]});j--;}
  else{r.push({t:-1,w:A[i-1]});i--;}}
  return r.reverse();
}

/* ── Resolve a section's text with current values ── */
function resolve(tmpl, vals, secKey, blockOverrides){
  if(blockOverrides && blockOverrides[secKey]) return blockOverrides[secKey];
  return tmpl.replace(/\{(\w+)\}/g, (_,id) => {
    const vr = VARS[id];
    if(!vr) return `{${id}}`;
    return vals[id] || vr.suggest || vr.prior;
  });
}
function resolvePrior(tmpl){
  return tmpl.replace(/\{(\w+)\}/g, (_,id) => {
    const vr = VARS[id]; return vr ? vr.prior : `{${id}}`;
  });
}

/* ── Render template with inline editable spans ── */
function renderEditable(tmpl, vals, setVals, editingId, setEditingId){
  // Split on both {var_id} tokens and [___] / [Note: ...] placeholders
  const parts = tmpl.split(/(\{\w+\}|\[___\]|\[Note:[^\]]+\])/g);
  return parts.map((part, i) => {
    // Fixed placeholder
    if(part === "[___]") return <span key={i} style={{background:"#F4F4F5",color:"#A1A1AA",padding:"1px 6px",borderRadius:3,fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.85em",letterSpacing:1,borderBottom:"2px dashed #D4D4D8"}}>___</span>;
    // Note annotation
    const noteMatch = part.match(/^\[Note:([^\]]+)\]$/);
    if(noteMatch) return <span key={i} style={{display:"block",marginTop:8,background:"#F4F4F5",color:"#71717A",padding:"8px 12px",borderRadius:5,fontSize:"0.78em",fontFamily:"'Outfit',sans-serif",lineHeight:1.5,fontStyle:"italic",borderLeft:"3px solid #D4D4D8"}}>{noteMatch[1].trim()}</span>;
    // Variable token
    const m = part.match(/^\{(\w+)\}$/);
    if(!m) return <span key={i}>{part}</span>;
    const id = m[1], vr = VARS[id];
    if(!vr) return <span key={i}>{part}</span>;
    const cur = vals[id] || "";
    const display = cur || vr.suggest || vr.prior;
    const changed = cur && cur !== vr.prior;
    const sm = SRC[vr.src];
    const isEditing = editingId === id;
    
    if(isEditing){
      return <InlineEditor key={id} id={id} vr={vr} cur={cur} display={display} sm={sm} vals={vals} setVals={setVals} close={()=>setEditingId(null)} />;
    }

    return (
      <span key={id}
        onClick={() => setEditingId(id)}
        title={`${sm.lb}: ${vr.hint||vr.autoSrc||"click to edit"}`}
        style={{
          background: changed ? "#FEF3C7" : sm.bg,
          color: changed ? "#92400E" : sm.c,
          padding:"1px 5px", borderRadius:3, cursor:"pointer",
          borderBottom:`2px solid ${changed ? "#F59E0B" : sm.ring}`,
          transition:"all .12s", fontFamily:"inherit", fontSize:"inherit",
          display:"inline",
        }}
      >{display}</span>
    );
  });
}

function InlineEditor({id, vr, cur, display, sm, vals, setVals, close}){
  const ref = useRef(null);
  const [local, setLocal] = useState(cur || "");
  useEffect(()=>{ if(ref.current){ ref.current.focus(); ref.current.select(); } },[]);

  const save = () => {
    if(local && local !== vr.prior) setVals(p=>({...p,[id]:local}));
    else if(!local || local === vr.prior) setVals(p=>{const n={...p};delete n[id];return n;});
    close();
  };

  return (
    <span style={{display:"inline-flex",flexDirection:"column",verticalAlign:"top",position:"relative",zIndex:20}}>
      <span style={{
        position:"absolute",bottom:"calc(100% + 6px)",left:0,
        background:"#18181B",color:"#FFF",borderRadius:6,padding:"10px 14px",
        boxShadow:"0 8px 30px rgba(0,0,0,.18)",minWidth:320,maxWidth:420,zIndex:30,
        fontFamily:"'Outfit',sans-serif",fontSize:12,lineHeight:1.6,
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontWeight:700,fontSize:13}}>{vr.hint || id}</span>
          <span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:sm.bg,color:sm.c,fontWeight:600}}>{sm.lb}</span>
        </div>
        {vr.autoSrc && <div style={{fontSize:11,color:"#A1A1AA",marginBottom:6}}>⚡ {vr.autoSrc}</div>}
        {vr.src==="counsel" && <div style={{fontSize:11,color:"#FCD34D",marginBottom:6}}>✎ Counsel to {vr.task==="update"?"supply":"confirm"}</div>}
        {vr.src==="client" && <div style={{fontSize:11,color:"#6EE7B7",marginBottom:6}}>◆ From client</div>}
        {vr.src==="underwriter" && <div style={{fontSize:11,color:"#C4B5FD",marginBottom:6}}>▲ From underwriters</div>}
        <div style={{fontSize:10,color:"#71717A",marginBottom:4}}>PRIOR: {vr.prior}</div>
        {vr.suggest && <div style={{fontSize:10,color:"#FCD34D",marginBottom:4}}>SUGGESTED: {vr.suggest}
          <span onClick={()=>{setLocal(vr.suggest);}} style={{marginLeft:6,cursor:"pointer",textDecoration:"underline"}}>use</span>
        </div>}
        <input ref={ref} value={local} onChange={e=>setLocal(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")close();}}
          style={{width:"100%",padding:"6px 8px",borderRadius:4,border:"1px solid #3F3F46",background:"#27272A",color:"#FFF",fontSize:13,fontFamily:"'IBM Plex Mono',monospace"}}
        />
        <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}>
          <button onClick={close} style={{padding:"4px 12px",borderRadius:4,border:"1px solid #3F3F46",background:"transparent",color:"#A1A1AA",fontSize:11,cursor:"pointer",fontFamily:"'Outfit'"}}>Cancel</button>
          <button onClick={save} style={{padding:"4px 12px",borderRadius:4,border:"none",background:"#F59E0B",color:"#18181B",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit'"}}>Save</button>
        </div>
        <div style={{position:"absolute",bottom:-5,left:20,width:10,height:10,background:"#18181B",transform:"rotate(45deg)"}}/>
      </span>
      <span style={{background:"#FEF3C7",color:"#92400E",padding:"1px 5px",borderRadius:3,borderBottom:"2px solid #F59E0B"}}>{local||display}</span>
    </span>
  );
}

/* ── MAIN ── */
export default function App(){
  const [setup, setSetup] = useState(false); // false = onboarding, true = app
  const [uploads, setUploads] = useState([]); // list of uploaded filing URLs
  const [uploadUrl, setUploadUrl] = useState("");
  const [view, setView] = useState("home");
  const [sec, setSec] = useState(null);
  const [vals, setVals] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [mode, setMode] = useState("edit"); // edit | preview
  const [redOpen, setRedOpen] = useState({});
  const [blockEdit, setBlockEdit] = useState(null);
  const [blockText, setBlockText] = useState("");
  const [blockOverrides, setBlockOverrides] = useState({});
  const [docMode, setDocMode] = useState("final"); // final | redline | edit
  const [tsLoaded, setTsLoaded] = useState(false);
  const [tsDocMode, setTsDocMode] = useState("final"); // final | redline | data

  useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"});},[view,sec]);
  useEffect(()=>{setEditingId(null);setBlockEdit(null);},[sec,view]);

  // Stats
  const allVarIds = Object.keys(VARS);
  const changedCount = allVarIds.filter(id => vals[id] && vals[id] !== VARS[id].prior).length;
  const touchedCount = Object.keys(vals).length;

  const goSec = k => { setSec(k); setView("sec"); setMode("edit"); };
  const goDoc = () => { setView("doc"); setDocMode("final"); };

  return(
  <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Outfit',sans-serif",background:"#FAFAF8",color:"#18181B"}} onClick={()=>{if(editingId)setEditingId(null);}}>
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#D4D4D8;border-radius:3px}
    input:focus,textarea:focus{outline:none}
    @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fu .25s ease both}
    .si{padding:7px 12px;border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:#71717A;transition:all .1s}
    .si:hover{background:rgba(255,255,255,.06);color:#D4D4D8}.si.on{background:rgba(255,255,255,.1);color:#FFF;font-weight:600}
    .bt{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:4px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:all .1s;border:none}
    .bd{background:#18181B;color:#FFF}.bd:hover{background:#333}
    .bo{background:transparent;color:#18181B;border:1.5px solid #E4E4E7}.bo:hover{border-color:#18181B}
    .pl{display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600}
  `}</style>

  {/* ═══ ONBOARDING ═══ */}
  {!setup && (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{maxWidth:560,width:"100%"}} className="fu">
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,letterSpacing:"-1px",lineHeight:1.15,marginBottom:8}}>PPS Assistant</div>
          <p style={{fontSize:14,color:"#71717A",lineHeight:1.7}}>Upload one or more prior prospectus supplements to pre-populate the drafting assistant with your issuer's sections, data, and boilerplate.</p>
        </div>

        {/* Upload area */}
        <div style={{background:"#FFF",border:"1px solid #E4E4E7",borderRadius:8,padding:20,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Prior Filings</div>
          
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            <input value={uploadUrl} onChange={e=>setUploadUrl(e.target.value)} placeholder="Paste SEC EDGAR URL or filing path…" style={{
              flex:1,padding:"8px 12px",borderRadius:5,border:"1px solid #E4E4E7",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",
            }}
            onKeyDown={e=>{if(e.key==="Enter"&&uploadUrl.trim()){setUploads(p=>[...p,{url:uploadUrl.trim(),type:"PPS",date:"detected at parse"}]);setUploadUrl("");}}}
            />
            <button className="bt bd" onClick={()=>{if(uploadUrl.trim()){setUploads(p=>[...p,{url:uploadUrl.trim(),type:"PPS",date:"detected at parse"}]);setUploadUrl("");}}} style={{whiteSpace:"nowrap"}}>+ Add</button>
          </div>

          {/* Uploaded filings list */}
          {uploads.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
              {uploads.map((u,i) => (
                <div key={i} style={{background:"#F4F4F5",borderRadius:5,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace",color:"#18181B",wordBreak:"break-all"}}>{u.url.length > 60 ? "…" + u.url.slice(-55) : u.url}</div>
                    <div style={{fontSize:10,color:"#A1A1AA",marginTop:2}}>{u.type}</div>
                  </div>
                  <button onClick={()=>setUploads(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#A1A1AA",cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Quick-load demo */}
          <div style={{borderTop:"1px solid #F4F4F5",paddingTop:12}}>
            <div style={{fontSize:11,fontWeight:600,color:"#A1A1AA",marginBottom:8}}>OR LOAD DEMO</div>
            <div onClick={()=>{
              setUploads([
                {url:"sec.gov/…/ea0240971-01.htm", type:"Preliminary Prospectus Supplement", date:"May 6, 2025"},
              ]);
            }} style={{
              background:"#FAFAF8",border:"1px dashed #E4E4E7",borderRadius:5,padding:"10px 14px",cursor:"pointer",transition:"all .12s",
            }} onMouseEnter={e=>{e.currentTarget.style.borderColor="#F59E0B";e.currentTarget.style.background="#FFFBEB";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#E4E4E7";e.currentTarget.style.background="#FAFAF8";}}>
              <div style={{fontWeight:700,fontSize:13}}>Starbucks Corp — Senior Notes</div>
              <div style={{fontSize:11,color:"#71717A",marginTop:2}}>Preliminary PS dated May 6, 2025 · 424(b)(5) · 3-tranche offering</div>
            </div>
          </div>
        </div>

        {/* What gets extracted */}
        {uploads.length > 0 && (
          <div style={{background:"#FFF",border:"1px solid #E4E4E7",borderRadius:8,padding:20,marginBottom:16}} className="fu">
            <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Will extract from {uploads.length} filing{uploads.length>1?"s":""}:</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {icon:"📄", label:"12 prose sections", desc:"Indenture, Company, Ranking, Redemption, Proceeds, Risk Factors, Credit, Notes Schedule, Underwriting, Tax, Settlement"},
                {icon:"🔢", label:"30+ variables", desc:"Financial figures, dates, entity names, ratings — each tagged by source (auto, counsel, client, underwriter)"},
                {icon:"📋", label:"Deal-term blanks", desc:"Make-whole spreads, par call dates, settlement, net proceeds — left as placeholders for the term sheet"},
                {icon:"📝", label:"Boilerplate sections", desc:"Covenant language, tax provisions, capitalization style, incorporated documents"},
              ].map((item,i) => (
                <div key={i} style={{display:"flex",gap:10,padding:"6px 0"}}>
                  <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:12.5}}>{item.label}</div>
                    <div style={{fontSize:11,color:"#A1A1AA",lineHeight:1.5}}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Launch button */}
        <button className="bt bd" disabled={uploads.length===0} onClick={()=>setSetup(true)} style={{
          width:"100%",justifyContent:"center",padding:"12px 20px",fontSize:14,
          opacity:uploads.length===0?0.4:1,cursor:uploads.length===0?"not-allowed":"pointer",
        }}>
          {uploads.length === 0 ? "Add a filing to get started" : `Parse ${uploads.length} filing${uploads.length>1?"s":""} & launch assistant →`}
        </button>

        <p style={{fontSize:11,color:"#A1A1AA",textAlign:"center",marginTop:12,lineHeight:1.6}}>
          In production, filings are parsed via EDGAR API + LLM extraction.<br/>
          This demo pre-populates from the Starbucks May 2025 filing.
        </p>
      </div>
    </div>
  )}

  {/* ═══ MAIN APP (only after setup) ═══ */}
  {setup && <>

  {/* SIDEBAR */}
  <div style={{width:220,background:"#18181B",position:"fixed",top:0,left:0,bottom:0,zIndex:50,display:"flex",flexDirection:"column"}}>
    <div style={{padding:"16px 14px 12px",borderBottom:"1px solid #27272A"}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#FFF"}}>PPS Assistant</div>
      <div style={{fontSize:10.5,color:"#52525B",marginTop:2}}>Starbucks Corp · Senior Notes</div>
      <div onClick={()=>setSetup(false)} style={{fontSize:9,color:"#3F3F46",marginTop:4,cursor:"pointer",textDecoration:"underline"}}>change filings</div>
    </div>
    <div style={{padding:"10px 14px",borderBottom:"1px solid #27272A"}}>
      <div style={{fontSize:10,color:"#52525B",marginBottom:4}}>{changedCount} updated · {touchedCount} touched</div>
      <div style={{height:3,background:"#27272A",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(100,(touchedCount/allVarIds.length)*100)}%`,background:"#F59E0B",borderRadius:2,transition:"width .4s"}}/>
      </div>
    </div>
    <div style={{flex:1,padding:"6px",overflowY:"auto"}}>
      <div className={`si ${view==="home"?"on":""}`} onClick={()=>setView("home")}>
        <span style={{width:14,textAlign:"center",fontSize:11}}>☰</span>Overview
      </div>
      <div style={{height:6}}/>
      <div style={{fontSize:9,fontWeight:700,color:"#3F3F46",textTransform:"uppercase",letterSpacing:".7px",padding:"2px 12px",marginBottom:2}}>Sections</div>
      {SECTIONS.map(s => {
        const varIds = [...s.text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).filter(id=>VARS[id]);
        const changed = varIds.filter(id=>vals[id]&&vals[id]!==VARS[id].prior).length;
        const hasBlock = !!blockOverrides[s.key];
        return(
        <div key={s.key} className={`si ${view==="sec"&&sec===s.key?"on":""}`} onClick={()=>goSec(s.key)}>
          <span style={{width:14,textAlign:"center",fontSize:9,fontWeight:700,color:(changed>0||hasBlock)?"#F59E0B":"#52525B",fontFamily:"'IBM Plex Mono',monospace"}}>
            {hasBlock?"✎":changed>0?`${changed}`:"·"}
          </span>
          <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title.length>22?s.title.slice(0,22)+"…":s.title}</span>
        </div>
      );})}
      <div style={{height:8}}/>
      <div className={`si ${view==="doc"?"on":""}`} onClick={goDoc} style={{borderTop:"1px solid #27272A",paddingTop:12,marginTop:4}}>
        <span style={{width:14,textAlign:"center",fontSize:12}}>📄</span>Full Document
      </div>
      <div className={`si ${view==="ts"?"on":""}`} onClick={()=>{setView("ts");setTsDocMode("final");}} style={{marginTop:2}}>
        <span style={{width:14,textAlign:"center",fontSize:12}}>📋</span>Term Sheet → Final
      </div>
    </div>
  </div>

  {/* MAIN */}
  <div style={{marginLeft:220,flex:1,minHeight:"100vh"}}>
    {/* Top bar */}
    <div style={{position:"sticky",top:0,zIndex:40,background:"#FAFAF8",borderBottom:"1px solid #E4E4E7",padding:"8px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{fontSize:13,fontWeight:600,color:"#52525B"}}>
        {view==="home"&&"All Sections"}
        {view==="sec"&&SECTIONS.find(s=>s.key===sec)?.title}
        {view==="doc"&&"Full Document — Preliminary"}
        {view==="ts"&&"Final Prospectus Supplement"}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {view==="sec"&&(
          <div style={{display:"flex",background:"#F4F4F5",borderRadius:5,padding:2,gap:1}}>
            <button onClick={()=>setMode("edit")} className="bt" style={{padding:"4px 12px",fontSize:11,background:mode==="edit"?"#FFF":"transparent",color:mode==="edit"?"#18181B":"#A1A1AA",boxShadow:mode==="edit"?"0 1px 3px rgba(0,0,0,.06)":"none",border:"none"}}>✎ Edit</button>
            <button onClick={()=>setMode("preview")} className="bt" style={{padding:"4px 12px",fontSize:11,background:mode==="preview"?"#FFF":"transparent",color:mode==="preview"?"#18181B":"#A1A1AA",boxShadow:mode==="preview"?"0 1px 3px rgba(0,0,0,.06)":"none",border:"none"}}>◉ Preview</button>
          </div>
        )}
        {view==="doc"&&(
          <div style={{display:"flex",background:"#F4F4F5",borderRadius:5,padding:2,gap:1}}>
            {["final","redline","edit"].map(m=>(
              <button key={m} onClick={()=>setDocMode(m)} className="bt" style={{padding:"4px 14px",fontSize:11,background:docMode===m?"#FFF":"transparent",color:docMode===m?"#18181B":"#A1A1AA",boxShadow:docMode===m?"0 1px 3px rgba(0,0,0,.06)":"none",border:"none",textTransform:"capitalize"}}>{m==="final"?"Final":m==="redline"?"Redline":"✎ Edit"}</button>
            ))}
          </div>
        )}
        {view==="ts"&&(
          <div style={{display:"flex",background:"#F4F4F5",borderRadius:5,padding:2,gap:1}}>
            {["final","redline","data"].map(m=>(
              <button key={m} onClick={()=>setTsDocMode(m)} className="bt" style={{padding:"4px 14px",fontSize:11,background:tsDocMode===m?"#FFF":"transparent",color:tsDocMode===m?"#18181B":"#A1A1AA",boxShadow:tsDocMode===m?"0 1px 3px rgba(0,0,0,.06)":"none",border:"none",textTransform:"capitalize"}}>{m==="final"?"Final":m==="redline"?"vs. Prelim":m==="data"?"📋 Data":"?"}</button>
            ))}
          </div>
        )}
        {view!=="home"&&<button className="bt bo" onClick={()=>setView("home")} style={{marginLeft:4}}>← All</button>}
      </div>
    </div>

    <div style={{padding:"20px 28px 56px",maxWidth:780}}>

    {/* ═══ HOME ═══ */}
    {view==="home"&&(
      <div className="fu">
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:700,letterSpacing:"-.5px",lineHeight:1.15,marginBottom:6}}>Preliminary Prospectus Supplement</h1>
        <p style={{fontSize:13,color:"#A1A1AA",lineHeight:1.7,maxWidth:580,marginBottom:16}}>
          Click any section to see the full prose with <span style={{background:"#DBEAFE",color:"#2563EB",padding:"0 4px",borderRadius:2,fontSize:12}}>highlighted variables</span> you can edit inline. Toggle between Edit and Preview mode to see the redline.
        </p>
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          {Object.entries(SRC).map(([k,m])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#A1A1AA"}}>
              <span style={{width:8,height:8,borderRadius:2,background:m.c,display:"inline-block"}}/>{m.lb}
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {SECTIONS.map(s=>{
            const varIds = [...s.text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).filter(id=>VARS[id]);
            const changed = varIds.filter(id=>vals[id]&&vals[id]!==VARS[id].prior).length;
            const hasBlock = !!blockOverrides[s.key];
            const srcCounts={};varIds.forEach(id=>{const sr=VARS[id].src;srcCounts[sr]=(srcCounts[sr]||0)+1;});
            const hasPlaceholder = s.text.includes("[___]");
            return(
              <div key={s.key} onClick={()=>goSec(s.key)} style={{
                background:"#FFF",border:"1px solid #E4E4E7",borderRadius:6,padding:"14px 18px",
                cursor:"pointer",transition:"all .12s",display:"flex",justifyContent:"space-between",alignItems:"center",
              }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.04)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
              >
                <div>
                  <div style={{fontWeight:600,fontSize:13.5,marginBottom:3}}>{s.title}</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {Object.entries(srcCounts).map(([k,c])=>(<span key={k} className="pl" style={{background:SRC[k].bg,color:SRC[k].c}}>{SRC[k].lb} ({c})</span>))}
                    {hasPlaceholder&&<span className="pl" style={{background:"#F4F4F5",color:"#A1A1AA"}}>pricing TBD</span>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {hasBlock&&<span className="pl" style={{background:"#FEF3C7",color:"#B45309"}}>✎ edited</span>}
                  {!hasBlock&&changed>0&&<span className="pl" style={{background:"#FEF3C7",color:"#B45309"}}>{changed} updated</span>}
                  <span style={{color:"#D4D4D8",fontSize:16}}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* ═══ SECTION ═══ */}
    {view==="sec"&&sec&&(()=>{
      const X = SECTIONS.find(s=>s.key===sec);
      const si = SECTIONS.findIndex(s=>s.key===sec);
      const priorText = resolvePrior(X.text);
      const newText = resolve(X.text, vals, X.key, blockOverrides);
      const hasDiff = priorText !== newText;
      const varIds = [...X.text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).filter(id=>VARS[id]);
      const isBlockEditing = blockEdit === X.key;
      const hasBlockOverride = !!blockOverrides[X.key];

      const startBlockEdit = () => {
        const resolved = resolve(X.text, vals, X.key, blockOverrides);
        setBlockText(resolved);
        setBlockEdit(X.key);
        setEditingId(null);
      };
      const saveBlockEdit = () => {
        if(blockText !== resolvePrior(X.text)){
          setBlockOverrides(p=>({...p,[X.key]:blockText}));
        } else {
          setBlockOverrides(p=>{const n={...p};delete n[X.key];return n;});
        }
        setBlockEdit(null);
      };
      const cancelBlockEdit = () => setBlockEdit(null);

      return(
        <div className="fu" onClick={e=>e.stopPropagation()}>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,marginBottom:4}}>{X.title}</h2>
          
          {/* Variable summary strip */}
          {!hasBlockOverride && varIds.length > 0 && (
            <div style={{display:"flex",gap:5,marginBottom:18,flexWrap:"wrap"}}>
              {varIds.map(id=>{
                const vr=VARS[id],sm=SRC[vr.src],changed=vals[id]&&vals[id]!==vr.prior;
                return <span key={id} className="pl" style={{background:changed?"#FEF3C7":sm.bg,color:changed?"#92400E":sm.c,cursor:"pointer",borderBottom:`1.5px solid ${changed?"#F59E0B":sm.ring}`}} onClick={()=>{if(!isBlockEditing)setEditingId(id);}}>{id}</span>;
              })}
            </div>
          )}
          {hasBlockOverride && (
            <div style={{display:"flex",gap:5,marginBottom:18,alignItems:"center"}}>
              <span className="pl" style={{background:"#FEF3C7",color:"#92400E",borderBottom:"1.5px solid #F59E0B"}}>block override active</span>
              <button onClick={()=>setBlockOverrides(p=>{const n={...p};delete n[X.key];return n;})} style={{fontSize:11,color:"#A1A1AA",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>revert to template</button>
            </div>
          )}

          {/* EDIT MODE */}
          {mode==="edit"&&!isBlockEditing&&(
            <div style={{
              background:"#FFF",border:"1px solid #E4E4E7",borderRadius:8,padding:"24px 28px",
              fontFamily:"'Cormorant Garamond',serif",fontSize:16.5,lineHeight:2,color:"#3F3F46",
              position:"relative",
            }}>
              <div style={{position:"absolute",top:10,right:14,display:"flex",gap:6,alignItems:"center"}}>
                {!hasBlockOverride && <span className="pl" style={{background:"#F4F4F5",color:"#A1A1AA",fontSize:9}}>CLICK HIGHLIGHTS TO EDIT</span>}
                <button onClick={startBlockEdit} title="Edit entire block" style={{
                  width:28,height:28,borderRadius:5,border:"1px solid #E4E4E7",background:"#FAFAF8",
                  cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,color:"#71717A",transition:"all .12s",
                }} onMouseEnter={e=>{e.currentTarget.style.background="#F4F4F5";e.currentTarget.style.color="#18181B";}} onMouseLeave={e=>{e.currentTarget.style.background="#FAFAF8";e.currentTarget.style.color="#71717A";}}>✎</button>
              </div>
              {hasBlockOverride
                ? <span>{blockOverrides[X.key]}</span>
                : renderEditable(X.text, vals, setVals, editingId, setEditingId)
              }
            </div>
          )}

          {/* BLOCK EDIT MODE */}
          {mode==="edit"&&isBlockEditing&&(
            <div style={{background:"#FFF",border:"2px solid #F59E0B",borderRadius:8,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",background:"#FFFBEB",borderBottom:"1px solid #FDE68A",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:600,color:"#92400E"}}>✎ Editing full section text</span>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={cancelBlockEdit} className="bt bo" style={{padding:"3px 12px",fontSize:11}}>Cancel</button>
                  <button onClick={saveBlockEdit} className="bt" style={{padding:"3px 12px",fontSize:11,background:"#F59E0B",color:"#18181B",fontWeight:700,border:"none"}}>Save</button>
                </div>
              </div>
              <textarea value={blockText} onChange={e=>setBlockText(e.target.value)} style={{
                width:"100%",minHeight:220,padding:"20px 24px",border:"none",resize:"vertical",
                fontFamily:"'Cormorant Garamond',serif",fontSize:16.5,lineHeight:2,color:"#3F3F46",
                background:"#FFF",outline:"none",
              }}/>
            </div>
          )}

          {/* PREVIEW MODE */}
          {mode==="preview"&&(
            <div>
              <div style={{
                background:"#FFF",border:"1px solid #E4E4E7",borderRadius:8,padding:"24px 28px",
                fontFamily:"'Cormorant Garamond',serif",fontSize:16.5,lineHeight:2,color:"#3F3F46",marginBottom:1,
                borderBottomLeftRadius: hasDiff?0:8, borderBottomRightRadius: hasDiff?0:8,
              }}>
                {newText}
              </div>
              {hasDiff&&(
                <div style={{
                  background:"#FEFCE8",borderLeft:"1px solid #E4E4E7",borderRight:"1px solid #E4E4E7",borderBottom:"1px solid #E4E4E7",
                  borderRadius:"0 0 8px 8px",padding:"16px 28px",
                }}>
                  <div style={{fontSize:11,fontWeight:700,color:"#A1A1AA",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                    Redline vs. Prior Deal
                    <span style={{display:"inline-flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#FEE2E2",display:"inline-block"}}/>removed</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#DCFCE7",display:"inline-block"}}/>added</span>
                  </div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12.5,lineHeight:2}}>
                    {wdiff(priorText,newText).map((s,i)=>{
                      if(s.t===0) return <span key={i}>{s.w}</span>;
                      if(s.t===-1) return <span key={i} style={{background:"#FEE2E2",color:"#991B1B",textDecoration:"line-through",padding:"0 1px",borderRadius:1}}>{s.w}</span>;
                      return <span key={i} style={{background:"#DCFCE7",color:"#166534",padding:"0 1px",borderRadius:1,fontWeight:600}}>{s.w}</span>;
                    })}
                  </div>
                </div>
              )}
              {!hasDiff&&(
                <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"0 0 8px 8px",padding:"10px 28px",fontSize:12,color:"#16A34A",fontWeight:600}}>
                  ✓ No changes from prior deal
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          <div style={{marginTop:20,display:"flex",gap:8}}>
            {si>0&&<button className="bt bo" onClick={()=>goSec(SECTIONS[si-1].key)}>← {SECTIONS[si-1].title.length>25?SECTIONS[si-1].title.slice(0,25)+"…":SECTIONS[si-1].title}</button>}
            {si<SECTIONS.length-1&&<button className="bt bd" onClick={()=>goSec(SECTIONS[si+1].key)}>{SECTIONS[si+1].title.length>25?SECTIONS[si+1].title.slice(0,25)+"…":SECTIONS[si+1].title} →</button>}
          </div>
        </div>
      );
    })()}

    {/* ═══ FULL DOCUMENT ═══ */}
    {view==="doc"&&(
      <div className="fu" onClick={e=>e.stopPropagation()}>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,letterSpacing:"-.5px",lineHeight:1.15,marginBottom:4}}>Starbucks Corporation</h1>
        <p style={{fontSize:14,color:"#52525B",marginBottom:20}}>Preliminary Prospectus Supplement — Senior Notes</p>

        {/* Change summary */}
        {(changedCount > 0 || Object.keys(blockOverrides).length > 0) && docMode !== "final" && (
          <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:6,padding:"10px 16px",marginBottom:20,fontSize:12,color:"#92400E"}}>
            {changedCount > 0 && <span style={{fontWeight:600}}>{changedCount} variable{changedCount!==1?"s":""} updated</span>}
            {changedCount > 0 && Object.keys(blockOverrides).length > 0 && <span> · </span>}
            {Object.keys(blockOverrides).length > 0 && <span style={{fontWeight:600}}>{Object.keys(blockOverrides).length} section{Object.keys(blockOverrides).length!==1?"s":""} manually edited</span>}
          </div>
        )}

        {docMode === "redline" && (
          <div style={{display:"flex",gap:14,marginBottom:16,fontSize:12,color:"#A1A1AA"}}>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#FEE2E2"}}/>Removed</span>
            <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#DCFCE7"}}/>Added</span>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {SECTIONS.map((s, idx) => {
            const priorText = resolvePrior(s.text);
            const newText = resolve(s.text, vals, s.key, blockOverrides);
            const hasDiff = priorText !== newText;

            return (
              <div key={s.key} style={{borderBottom: idx < SECTIONS.length - 1 ? "1px solid #E4E4E7" : "none"}}>
                {/* Section header */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"20px 0 8px"}}>
                  <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:700,color:"#18181B",textTransform:"uppercase",letterSpacing:".5px"}}>{s.title}</h3>
                  {docMode !== "edit" && hasDiff && <span className="pl" style={{background:"#FEF3C7",color:"#B45309"}}>changed</span>}
                  {docMode === "edit" && (
                    <span onClick={()=>goSec(s.key)} style={{fontSize:11,color:"#2563EB",cursor:"pointer",fontWeight:600}}>edit →</span>
                  )}
                </div>

                {/* FINAL mode — clean resolved text */}
                {docMode === "final" && (
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif",fontSize:16,lineHeight:2,color:"#3F3F46",
                    padding:"4px 0 16px",
                  }}>
                    {newText}
                  </div>
                )}

                {/* REDLINE mode — word diff */}
                {docMode === "redline" && (
                  <div style={{padding:"4px 0 16px"}}>
                    {hasDiff ? (
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12.5,lineHeight:2}}>
                        {wdiff(priorText, newText).map((sg, i) => {
                          if(sg.t === 0) return <span key={i}>{sg.w}</span>;
                          if(sg.t === -1) return <span key={i} style={{background:"#FEE2E2",color:"#991B1B",textDecoration:"line-through",padding:"0 1px",borderRadius:1}}>{sg.w}</span>;
                          return <span key={i} style={{background:"#DCFCE7",color:"#166534",padding:"0 1px",borderRadius:1,fontWeight:600}}>{sg.w}</span>;
                        })}
                      </div>
                    ) : (
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,lineHeight:2,color:"#A1A1AA"}}>
                        {newText}
                      </div>
                    )}
                  </div>
                )}

                {/* EDIT mode — inline editable highlights */}
                {docMode === "edit" && (
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif",fontSize:16,lineHeight:2,color:"#3F3F46",
                    padding:"4px 0 16px",
                  }}>
                    {blockOverrides[s.key]
                      ? <span>{blockOverrides[s.key]}</span>
                      : renderEditable(s.text, vals, setVals, editingId, setEditingId)
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* ═══ TERM SHEET → FINAL ═══ */}
    {view==="ts"&&(
      <div className="fu" onClick={e=>e.stopPropagation()}>
        {!tsLoaded ? (
          <div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,letterSpacing:"-.5px",lineHeight:1.15,marginBottom:4}}>Term Sheet → Final PS</h1>
            <p style={{fontSize:13,color:"#A1A1AA",lineHeight:1.7,maxWidth:580,marginBottom:24}}>
              Upload the pricing term sheet to fill in all deal-specific blanks from the preliminary and generate the final prospectus supplement.
            </p>
            <div onClick={()=>setTsLoaded(true)} style={{
              border:"2px dashed #E4E4E7",borderRadius:8,padding:"40px 28px",textAlign:"center",
              cursor:"pointer",transition:"all .15s",background:"#FFF",
            }} onMouseEnter={e=>{e.currentTarget.style.borderColor="#DC2626";e.currentTarget.style.background="#FEF2F2";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#E4E4E7";e.currentTarget.style.background="#FFF";}}>
              <div style={{fontSize:36,marginBottom:8}}>📋</div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Upload Pricing Term Sheet</div>
              <div style={{fontSize:12,color:"#A1A1AA",marginBottom:12}}>Accepts FWP / Rule 433 filings</div>
              <div style={{fontSize:11,color:"#DC2626",fontWeight:600}}>Click to load Starbucks May 6, 2025 demo →</div>
            </div>
          </div>
        ) : (
          <div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,letterSpacing:"-.5px",lineHeight:1.15,marginBottom:4}}>Starbucks Corporation</h1>
            <p style={{fontSize:14,color:"#52525B",marginBottom:6}}>Final Prospectus Supplement — {TERM_SHEET.deal_size} Senior Notes</p>
            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
              {TERM_SHEET.tranches.map((t,i)=>(
                <span key={i} className="pl" style={{background:"#FEF2F2",color:"#DC2626",fontSize:11,padding:"3px 10px"}}>{t.principal} {t.coupon} due {t.maturity}</span>
              ))}
            </div>

            {tsDocMode === "data" && (
              <div>
                <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:6,padding:"12px 16px",marginBottom:16,fontSize:12,color:"#991B1B"}}>
                  <span style={{fontWeight:700}}>{TS_FIELDS.length} data points</span> extracted from term sheet and applied to the final.
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {TS_FIELDS.map(f=>(
                    <div key={f.id} style={{background:"#FFF",border:"1px solid #E4E4E7",borderRadius:5,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:12.5}}>{f.label}</div>
                        <div style={{fontSize:11,color:"#A1A1AA",marginTop:1}}>{f.section}</div>
                      </div>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#DC2626",textAlign:"right",maxWidth:360}}>{f.val}</div>
                    </div>
                  ))}
                </div>
                {(()=>{
                  const unresolved = [];
                  FINAL_SECTIONS.forEach(s => {
                    const vrs = [...s.text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).filter(id=>VARS[id]);
                    vrs.forEach(id => { if(!vals[id] && VARS[id].task === "update") unresolved.push({id, hint: VARS[id].hint || id, sec: s.title}); });
                  });
                  if(!unresolved.length) return (
                    <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:6,padding:"12px 16px",marginTop:16,fontSize:12,color:"#16A34A",fontWeight:600}}>
                      ✓ All data resolved — no additional information required.
                    </div>
                  );
                  return (
                    <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:6,padding:"12px 16px",marginTop:16}}>
                      <div style={{fontWeight:700,fontSize:12,color:"#92400E",marginBottom:6}}>⚠ {unresolved.length} items still using prior-deal values</div>
                      <div style={{fontSize:11,color:"#92400E",lineHeight:1.6,marginBottom:8}}>Not in the term sheet and not updated in the prelim. Verify these are current:</div>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {unresolved.map(u=>(
                          <div key={u.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#92400E",padding:"4px 8px",background:"#FFFBEB",borderRadius:3}}>
                            <span style={{fontWeight:600}}>{u.hint}</span>
                            <span style={{color:"#B45309"}}>{u.sec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {tsDocMode === "final" && (
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {FINAL_SECTIONS.map((s, idx) => (
                  <div key={s.key} style={{borderBottom: idx < FINAL_SECTIONS.length - 1 ? "1px solid #E4E4E7" : "none"}}>
                    <div style={{padding:"20px 0 8px"}}><h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:700,color:"#18181B",textTransform:"uppercase",letterSpacing:".5px"}}>{s.title}</h3></div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,lineHeight:2,color:"#3F3F46",padding:"4px 0 16px"}}>{resolve(s.text, vals, s.key, blockOverrides)}</div>
                  </div>
                ))}
              </div>
            )}

            {tsDocMode === "redline" && (
              <div>
                <div style={{display:"flex",gap:14,marginBottom:16,fontSize:12,color:"#A1A1AA"}}>
                  <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#FEE2E2"}}/>In prelim only</span>
                  <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"#DCFCE7"}}/>Added in final</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {FINAL_SECTIONS.map((s, idx) => {
                    const ps = SECTIONS.find(x=>x.key===s.key);
                    const pt = ps ? resolve(ps.text, vals, ps.key, blockOverrides) : "";
                    const ft = resolve(s.text, vals, s.key, blockOverrides);
                    const diff = pt !== ft;
                    return (
                      <div key={s.key} style={{borderBottom: idx < FINAL_SECTIONS.length - 1 ? "1px solid #E4E4E7" : "none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"20px 0 8px"}}>
                          <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:700,color:"#18181B",textTransform:"uppercase",letterSpacing:".5px"}}>{s.title}</h3>
                          {diff && <span className="pl" style={{background:"#FEF2F2",color:"#DC2626"}}>changed</span>}
                        </div>
                        <div style={{padding:"4px 0 16px"}}>
                          {diff ? (
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12.5,lineHeight:2}}>
                              {wdiff(pt, ft).map((sg, i) => {
                                if(sg.t === 0) return <span key={i}>{sg.w}</span>;
                                if(sg.t === -1) return <span key={i} style={{background:"#FEE2E2",color:"#991B1B",textDecoration:"line-through",padding:"0 1px",borderRadius:1}}>{sg.w}</span>;
                                return <span key={i} style={{background:"#DCFCE7",color:"#166534",padding:"0 1px",borderRadius:1,fontWeight:600}}>{sg.w}</span>;
                              })}
                            </div>
                          ) : (
                            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,lineHeight:2,color:"#A1A1AA"}}>{ft}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{marginTop:24,display:"flex",gap:8}}>
              <button className="bt bo" onClick={()=>setTsLoaded(false)}>← Change Term Sheet</button>
              <button className="bt bd">Export Final PS (.docx)</button>
            </div>
          </div>
        )}
      </div>
    )}

    </div>
  </div>
  </>}
  </div>);
}
