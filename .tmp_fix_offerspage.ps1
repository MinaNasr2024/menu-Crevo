$path = 'frontend/src/pages/OffersPage.jsx'
$text = Get-Content $path -Raw
$text = $text.Replace('totalPrice: String(offer.totalPrice ? '''')', 'totalPrice: String(offer.totalPrice ?? '''')')
$text = $text.Replace('const mode = String(group.selectionMode ? '''') === ''radio''', 'const mode = String(group.selectionMode ?? '''') === ''radio''')
$text = $text.Replace('    : String(group.selectionMode ? '''') === ''checkbox''', '    : String(group.selectionMode ?? '''') === ''checkbox''')
$text = $text.Replace('titleAr: String(group.titleAr ? '''').trim() || `مجموعة ${index + 1}`', 'titleAr: String(group.titleAr ?? '''').trim() || `مجموعة ${index + 1}`')
$text = $text.Replace('<div className="mt-2 text-lg font-black text-gold">EGP {Number(offer.totalPrice ? 0).toFixed(2)}</div>', '<div className="mt-2 text-lg font-black text-gold">EGP {Number(offer.totalPrice ?? 0).toFixed(2)}</div>')
Set-Content $path $text -Encoding utf8
