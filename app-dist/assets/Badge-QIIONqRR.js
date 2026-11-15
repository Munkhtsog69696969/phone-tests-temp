import{t as e}from"./jsx-runtime-C_urxT9I.js";import{x as t}from"./AppLayout-CeUQeVDs.js";var n=e(),r={active:t.success,paid:t.success,shipped:t.success,delivered:t.success,pending:t.warning,error:t.danger,refunded:t.danger,vip:t.info,enterprise:t.info,lead:t.info,unread:t.info,processing:t.info,inactive:t.neutral,smb:t.neutral,unfulfilled:t.neutral,draft:t.neutral,stable:t.neutral};function i({children:e,variant:t=`active`,dot:i=!1,className:a=``}){return(0,n.jsxs)(`span`,{className:`
        inline-flex items-center gap-1 px-2 py-0.5 min-h-6 rounded-full
        text-xs font-medium leading-5 align-middle
        min-w-0 max-w-full break-words
        ${r[t]}
        ${a}
      `,children:[i&&(0,n.jsxs)(`span`,{className:`relative flex w-1.5 h-1.5 flex-shrink-0`,children:[t===`active`&&(0,n.jsx)(`span`,{className:`absolute inline-flex h-full w-full rounded-full bg-current opacity-50 animate-ping`}),(0,n.jsx)(`span`,{className:`relative inline-flex w-1.5 h-1.5 rounded-full bg-current`})]}),e]})}export{i as t};