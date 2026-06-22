$path = 'frontend/src/components/OfferBuilderForm.jsx'
$text = Get-Content $path -Raw
$text = $text.Replace('...(value.items  []),', '...(value.items ?? []),')
$text = $text.Replace('sortOrder: (value.items?.length  0)', 'sortOrder: (value.items?.length ?? 0)')
Set-Content $path $text -Encoding utf8
