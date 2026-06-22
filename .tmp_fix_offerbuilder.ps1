$path = 'frontend/src/components/OfferBuilderForm.jsx'
$text = Get-Content $path -Raw
$text = $text.Replace('EGP {Number(product.price  0).toFixed(2)}', 'EGP {Number(product.price ?? 0).toFixed(2)}')
$text = $text.Replace('EGP {Number(product?.price  0).toFixed(2)}', 'EGP {Number(product?.price ?? 0).toFixed(2)}')
$text = $text.Replace('value.selectionMode  ''''', 'value.selectionMode ?? ''''')
$text = $text.Replace('value.noteEn  ''''', 'value.noteEn ?? ''''')
$text = $text.Replace('value.groups?.length  0', 'value.groups?.length ?? 0')
$text = $text.Replace('product.price  0', 'product.price ?? 0')
Set-Content $path $text -Encoding utf8
