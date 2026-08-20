import { File } from 'expo-file-system';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dndekbare';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'tuteepay_uploads';
const CLOUDINARY_API_KEY = process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY || '885611659878567';

export const uploadToCloudinary = async (
  fileUri: string,
  folder: string = 'tuteepay'
): Promise<string> => {
  const file = new File(fileUri);
  const base64 = await file.base64();

  const formData = new FormData();
  formData.append('file', `data:image/jpeg;base64,${base64}`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('api_key', CLOUDINARY_API_KEY);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  return data.secure_url as string;
};
