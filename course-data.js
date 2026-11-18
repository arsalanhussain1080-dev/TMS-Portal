/* TMS Batch 1 source of truth. Titles preserved exactly from the supplied Trader Sajjad Shah code. */
window.TMS_COURSE_TITLES=[
['TMS NODE 1: (Liquidity & Inefficiency)','LEC 1: Introduction to TMS - Trader Sajjad Shah','LEC 2: ICT Volume Imbalance'],
['TMS NODE 2: (Dealing Range Theory)','LEC 1: Introduction to Dealing Ranges','LEC 2: Premium & Discount Arrays'],
['TMS NODE 3: (FVG Types & Techniques)','LEC 1: Fair Value Gap Identification','LEC 2: Advanced FVG Rebalancing Strategies'],
['TMS NODE 4: (ICT Block Theory & MSS)','LEC 1: Order Blocks & Breaker Blocks','LEC 2: Market Structure Shift (MSS)'],
['TMS NODE 5: (ICT Bonus PD Arrays)','LEC 1: Mitigation Blocks & Rejection Blocks','LEC 2: Liquidity Voids & Propulsion Blocks'],
['TMS NODE 6: (ICT Swing Theory)','LEC 1: Swing Highs & Swing Lows Setup','LEC 2: Internal vs External Range Liquidity'],
['TMS NODE 7: (Intraday Architecture)','LEC 1: Session Openings & Key Levels','LEC 2: Intraday Price Delivery Framework'],
['TMS NODE 8: (ICT Time & Price Theory)','LEC 1: Timing Daily Market Cycles','LEC 2: Killzones & Opening Ranges'],
['TMS NODE 9: (ICT Power of 3 - Classic Buy/Sell Day)','LEC 1: Accumulation, Manipulation & Distribution (AMD)','LEC 2: Identifying Classic Buy & Sell Days'],
['TMS NODE 10: (ICT Trading Models)','LEC 1: Core Algorithmic Model Walkthrough','LEC 2: Execution Checklist & Rules'],
['TMS NODE 11: (IMPERIUM X - Risk Management)','LEC 1: Capital Preservation & Lot Sizing','LEC 2: Trader Psychology & Risk Discipline']
];
window.TMS_PREVIEW_LOCK_KEY="tms_preview_lecture_locks_v1";
window.TMS_READ_LOCKS=function(){try{const v=JSON.parse(localStorage.getItem(window.TMS_PREVIEW_LOCK_KEY)||"[]");return new Set(Array.isArray(v)?v:[])}catch{return new Set()}};
window.TMS_WRITE_LOCKS=function(set){localStorage.setItem(window.TMS_PREVIEW_LOCK_KEY,JSON.stringify([...set]));};
