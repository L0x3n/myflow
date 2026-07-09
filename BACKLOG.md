# BACKLOG — byggs INTE i MVP

Scope-vakt (MASTERPLAN §9). Inget av detta byggs förrän vecka 4-gaten är passerad.

- Kalendersync (Google/Apple/Outlook OAuth)
- Inköpslista
- Röststyrning
- Familjedelning
- Platsbaserade påminnelser
- Ekonomi/fakturor/OCR
- FlowScore
- Smarta hem
- Restidsberäkning
- Native-appar

## Idéer som dykt upp under bygget

- Äkta Web Push när appen är stängd kräver backend-cron + push-prenumerationer
  (Supabase har ingen inbyggd schemalagd push). MVP:n får notiser via service
  worker/Notification API medan appen är öppen/installerad — utvärdera pg_cron +
  web-push i vecka 5+ om testanvändaren saknar påminnelser.
