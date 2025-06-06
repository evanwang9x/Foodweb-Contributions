// Please note this is only the relevant for pulling Images so that ImageCarousel would display it. A lot of stuff is
// missing compared to the actual folder


import { type DatabaseClient } from '@foodweb/database'
import { decode } from 'base64-arraybuffer'

import { getClient } from './db'


  /**
   * Downloads an invoice page from storage and returns it as a base64 string
   * @param invoiceUuid - Unique identifier for the invoice
   * @param filename - Name of the file to download (without extension)
   * @param extension - File extension (defaults to 'jpg')
   * @returns Promise that resolves to a base64 string of the image, or null if not found
   */
  private async downloadInvoicePage(
      invoiceUuid: string,
      filename: string,
      extension: string = 'jpg'
  ): Promise < string | null > {
      const path = `${this.restaurantId}/invoices/${invoiceUuid}/scans/${filename}.${extension}`

    const { data, error } = await this.storageClient
          .from('restaurants')
          .download(path)

    if(error) {
          console.error('Error downloading invoice page:', error)
          return null
      }

    if(!data) {
          return null
      }

    return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
              const base64String = reader.result?.toString().split(',')[1]
              if (base64String) {
                  resolve(base64String)
              } else {
                  reject(new Error('Failed to convert to base64'))
              }
          }
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(data)
      })
  }

  /**
   * Downloads all pages of an invoice
   * @param invoiceUuid - Unique identifier for the invoice
   * @returns Promise that resolves to an array of base64 encoded images
   */
  async downloadAllInvoicePages(invoiceUuid: string): Promise < string[] > {
    const prefix = `${this.restaurantId}/invoices/${invoiceUuid}/scans/`;
    const { data: files, error } = await this.storageClient
        .from('restaurants')
        .list(prefix)

    if(error || !files) {
    return [];
}

const pageFiles = files
    .filter(file => file.name.startsWith('invoice-page-'))
    .sort((a, b) => {
        const pageA = parseInt(a.name.split('-')[2].split('.')[0], 10);
        const pageB = parseInt(b.name.split('-')[2].split('.')[0], 10);
        return pageA - pageB;
    });

const promises = pageFiles.map(file => {
    const filename = file.name.split('.')[0];
    return this.downloadInvoicePage(invoiceUuid, filename);
});

const results = await Promise.all(promises);
return results.filter((result): result is string => result !== null);
  }
}