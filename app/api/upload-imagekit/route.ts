import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { file, fileName, folder } = body;

    if (!file || !fileName) {
      return NextResponse.json(
        { error: "file and fileName are required" },
        { status: 400 }
      );
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "IMAGEKIT_PRIVATE_KEY is not configured" },
        { status: 500 }
      );
    }

    // Prepare FormData for ImageKit upload endpoint
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", fileName);
    if (folder) {
      formData.append("folder", folder);
    }
    formData.append("useUniqueFileName", "true");

    // Basic Auth header using privateKey as username, empty password
    const authHeader = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

    const ikResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    const data = await ikResponse.json();

    if (!ikResponse.ok) {
      console.error("ImageKit upload error:", data);
      return NextResponse.json(
        { error: data.message || "Failed to upload to ImageKit" },
        { status: ikResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.url,
      fileId: data.fileId,
      name: data.name,
      filePath: data.filePath,
    });
  } catch (error: any) {
    console.error("ImageKit API Route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
