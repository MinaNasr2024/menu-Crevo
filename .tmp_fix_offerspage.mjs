const fs = require('fs');
const path = 'frontend/src/pages/OffersPage.jsx';
let text = fs.readFileSync(path, 'utf8');
const reps = [
  [/nameAr: offer\.nameAr \? ''/g, "nameAr: offer.nameAr ?? ''"],
  [/nameEn: offer\.nameEn \? ''/g, "nameEn: offer.nameEn ?? ''"],
  [/noteAr: offer\.noteAr \? ''/g, "noteAr: offer.noteAr ?? ''"],
  [/noteEn: offer\.noteEn \? ''/g, "noteEn: offer.noteEn ?? ''"],
  [/totalPrice: String\(offer\.totalPrice \? ''\)/g, "totalPrice: String(offer.totalPrice ?? '')"],
  [/imageUrl: offer\.imageUrl \? ''/g, "imageUrl: offer.imageUrl ?? ''"],
  [/titleAr: group\.titleAr \? ''/g, "titleAr: group.titleAr ?? ''"],
  [/titleEn: group\.titleEn \? ''/g, "titleEn: group.titleEn ?? ''"],
  [/selectionMode: group\.selectionMode \? ''/g, "selectionMode: group.selectionMode ?? ''"],
  [/minSelect: String\(group\.minSelect \? 1\)/g, "minSelect: String(group.minSelect ?? 1)"],
  [/maxSelect: String\(group\.maxSelect \? 1\)/g, "maxSelect: String(group.maxSelect ?? 1)"],
  [/sortOrder: String\(group\.sortOrder \? index\)/g, "sortOrder: String(group.sortOrder ?? index)"],
  [/extraPrice: String\(item\.extraPrice \? 0\)/g, "extraPrice: String(item.extraPrice ?? 0)"],
  [/sortOrder: String\(item\.sortOrder \? itemIndex\)/g, "sortOrder: String(item.sortOrder ?? itemIndex)"],
  [/reader\.onload = \(\) => resolve\(String\(reader\.result \? ''\)\);/g, "reader.onload = () => resolve(String(reader.result ?? ''));"],
  [/nameAr: String\(form\.nameAr \? ''\)\.trim\(\)/g, "nameAr: String(form.nameAr ?? '').trim()"],
  [/nameEn: String\(form\.nameEn \? ''\)\.trim\(\) \|\| String\(form\.nameAr \? ''\)\.trim\(\)/g, "nameEn: String(form.nameEn ?? '').trim() || String(form.nameAr ?? '').trim()"],
  [/noteEn: String\(form\.noteEn \? ''\)\.trim\(\)/g, "noteEn: String(form.noteEn ?? '').trim()"],
  [/totalPrice: String\(form\.totalPrice \? ''\)\.trim\(\)/g, "totalPrice: String(form.totalPrice ?? '').trim()"],
  [/imageUrl: String\(form\.imageUrl \? ''\)\.trim\(\)/g, "imageUrl: String(form.imageUrl ?? '').trim()"],
  [/titleAr: String\(group\.titleAr \? ''\)\.trim\(\) \|\| `مجموعة \$\{index \+ 1\}`/g, "titleAr: String(group.titleAr ?? '').trim() || `مجموعة ${index + 1}`"],
  [/selectionMode: String\(group\.selectionMode \? ''\)\.trim\(\)/g, "selectionMode: String(group.selectionMode ?? '').trim()"],
  [/minSelect: Number\(group\.minSelect \? 1\)/g, "minSelect: Number(group.minSelect ?? 1)"],
  [/maxSelect: Number\(group\.maxSelect \? 1\)/g, "maxSelect: Number(group.maxSelect ?? 1)"],
  [/sortOrder: Number\(group\.sortOrder \? index\)/g, "sortOrder: Number(group.sortOrder ?? index)"],
  [/extraPrice: Number\(item\.extraPrice \? 0\)/g, "extraPrice: Number(item.extraPrice ?? 0)"],
  [/sortOrder: Number\(item\.sortOrder \? itemIndex\)/g, "sortOrder: Number(item.sortOrder ?? itemIndex)"],
  [/setEditingId\(updatedOffer\.id \? editingId\);/g, 'setEditingId(updatedOffer.id ?? editingId);'],
  [/setEditingId\(createdOffer\.id \? null\);/g, 'setEditingId(createdOffer.id ?? null);'],
  [/return \(form\.groups \? \[\]\)\.reduce\(\(sum, group\) => sum \+ \(group\.items\?\.length \? 0\), 0\);/g, 'return (form.groups ?? []).reduce((sum, group) => sum + (group.items?.length ?? 0), 0);'],
  [/tone=\{toast\?\.type \? 'success'\}/g, "tone={toast?.type ?? 'success'}"]
];
for (const [re, to] of reps) text = text.replace(re, to);
fs.writeFileSync(path, text, 'utf8');
