import * as DocumentPicker from 'expo-document-picker';
// Use legacy FileSystem API to avoid deprecation issues with writeAsStringAsync/readAsStringAsync
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

// Safely resolve Base64 encoding constant for environments where
// FileSystem.EncodingType may be undefined (to avoid `.base64` of undefined errors)
const BASE64_ENCODING =
  (FileSystem.EncodingType && FileSystem.EncodingType.Base64) || 'base64';

// Import Excel file
export const importExcel = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return null;
    }

    const fileUri = result.assets[0].uri;
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: BASE64_ENCODING,
    });

    const workbook = XLSX.read(fileContent, { type: 'base64' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return data;
  } catch (error) {
    console.error('Error importing Excel:', error);
    throw error;
  }
};

// Export data to Excel
export const exportToExcel = async (data, filename) => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    if (Platform.OS === 'web') {
      // Web: trigger browser download
      XLSX.writeFile(workbook, filename);
      return;
    }

    const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(uri, wbout, { encoding: BASE64_ENCODING });

    // Show native share sheet so user can save the file somewhere visible (Downloads, Drive, etc.).
    // Use dynamic import so the app still bundles even if expo-sharing is not installed.
    try {
      const Sharing = await import('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: filename,
        });
      } else {
        console.log('Sharing is not available, file saved at:', uri);
      }
    } catch (shareError) {
      console.warn('Sharing module not available; file saved at:', uri, shareError);
    }

    return uri;
  } catch (error) {
    console.error('Error exporting Excel:', error);
    throw error;
  }
};

// Generate template for students
export const generateStudentTemplate = () => {
  return [
    {
      'Name': 'John Doe',
      'Email': 'john.doe@example.com',
      'Phone': '1234567890',
      'Roll Number': '1',
    },
  ];
};

// Generate template for teachers
export const generateTeacherTemplate = () => {
  return [
    {
      'Name': 'Jane Smith',
      'Email': 'jane.smith@example.com',
      'Phone': '1234567890',
      'Department': 'DCSE',
    },
  ];
};

