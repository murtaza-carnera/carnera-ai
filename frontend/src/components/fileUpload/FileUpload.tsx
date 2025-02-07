import { useState } from 'react';

const FileUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onloadend = async () => {
      const base64Data = reader.result?.toString().split(',')[1];
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64Data, fileName: selectedFile.name, fileType: selectedFile.type, fileSize: selectedFile.size, lastModified: selectedFile.lastModified }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('File uploaded successfully');
      } else {
        alert(`Upload failed: ${data.error}`);
      }
    };
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
};

export default FileUpload;
