import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { RECEIPT_IMAGE_DIR } from '../constants';
import { id } from './date';

export async function copyReceiptImage(asset) {
  const source = new File(asset.uri);
  const directory = new Directory(Paths.document, RECEIPT_IMAGE_DIR);
  directory.create({ idempotent: true, intermediates: true });

  const destination = new File(directory, `${id()}${receiptImageExtension(asset)}`);
  source.copy(destination);

  return {
    assetId: asset.assetId || null,
    fileName: asset.fileName || destination.name,
    uri: destination.uri,
  };
}

export async function ensureReceiptAlbum(asset) {
  const albumName = 'Receipt Vault';
  const album = await MediaLibrary.getAlbumAsync(albumName);
  if (album) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    return album;
  }
  return MediaLibrary.createAlbumAsync(albumName, asset, false);
}

export async function saveReceiptImageToPhotoLibrary(uri) {
  const asset = await MediaLibrary.createAssetAsync(uri);
  await ensureReceiptAlbum(asset);
  return asset;
}

export function normalizeReceiptImages(images) {
  return (Array.isArray(images) ? images : [])
    .map((image) => typeof image === 'string' ? { uri: image, assetId: null, fileName: image.split('/').pop() || 'receipt' } : image)
    .filter((image) => image?.uri);
}

function receiptImageExtension(asset) {
  const name = asset.fileName || asset.uri || '';
  const match = name.match(/\.[a-z0-9]+(?:\?|#|$)/i);
  if (match) return match[0].replace(/[?#].*$/, '').toLowerCase();
  if (asset.mimeType === 'image/png') return '.png';
  if (asset.mimeType === 'image/heic') return '.heic';
  return '.jpg';
}
