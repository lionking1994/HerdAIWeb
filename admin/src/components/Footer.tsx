import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import FileDropZone from './FileDropZone';

interface ContactData {
  username: string;
  useremail: string;
  usermessage: string;
}

export default function Footer(): JSX.Element {
  const [isContactModalOpen, setContactModalOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setFeedbackModalOpen] = useState<boolean>(false);
  const [isTermsModalOpen, setTermsModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    const contactData: ContactData = {
      username: (form['contact-name'] as HTMLInputElement).value,
      useremail: (form['contact-email'] as HTMLInputElement).value,
      usermessage: (form['contact-message'] as HTMLTextAreaElement).value,
    };

    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/contactus/send`,
        contactData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      toast("Contact data sent successfully!");
      setContactModalOpen(false);
    } catch (error) {
      toast("Error sending contact data.", { type: "error" });
      console.error('Error sending contact data:', error);
    }
  };

  const handleFileUpload = (file: File | null): void => {
    setSelectedFile(file);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData();

    formData.append('subject', (form['feedback-subject'] as HTMLInputElement).value);
    formData.append('details', (form['feedback-message'] as HTMLTextAreaElement).value);
    formData.append('url', window.location.href);

    if (selectedFile) {
      formData.append('attachment', selectedFile);
    }

    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/feedback/save-feedback`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      toast.success("Feedback sent successfully!");
      setFeedbackModalOpen(false);
      setSelectedFile(null);
    } catch (error) {
      toast.error("Error sending feedback.");
      console.error('Error sending feedback:', error);
    }
  };

  const handleTermsOpen = (): void => {
    setTermsModalOpen(true);
  };

  useEffect(() => {
    console.log(isContactModalOpen);
  }, [isContactModalOpen]);

  return (
    <footer className="bg-gray-800 p-1 text-white flex flex-col items-center w-full pb-12 md:pb-0 mt-auto">
      <div className="grid grid-cols-2 justify-center text-center gap-2 sm:gap-10 pb-1 sm:grid-cols-none sm:flex">
        <span><div className="text-white cursor-pointer hover:underline">About Us</div></span>
        <span>
          <div className="text-white cursor-pointer hover:underline" onClick={() => setContactModalOpen(true)}>Contact Us</div>
        </span>
        <span>
          <div className="text-white cursor-pointer hover:underline" onClick={() => {
            setFeedbackModalOpen(true);
          }}>Give feedback</div>
        </span>
        <span>
          <div className="text-white cursor-pointer hover:underline" onClick={handleTermsOpen}>Terms & Conditions</div>
        </span>
      </div>
      <div className="text-center mb-3">
        <p className="text-sm">© {new Date().getFullYear()} Herd AI. All rights reserved.</p>
      </div>

      {isContactModalOpen && (
        <div className="text-black fixed inset-0 flex items-center justify-center bg-[#0007]">
          <form onSubmit={handleContactSubmit} className="bg-white p-6 rounded-lg shadow-lg w-[500px]">
            <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
            <label className="block mb-2" htmlFor="contact-name">Name</label>
            <input id="contact-name" type="text" placeholder="Name" required className="border border-gray-300 p-3 w-full my-2 rounded" />
            <label className="block mb-2" htmlFor="contact-email">Email</label>
            <input id="contact-email" type="email" placeholder="Email" required className="border border-gray-300 p-3 w-full my-2 rounded" />
            <label className="block mb-2" htmlFor="contact-message">Message</label>
            <textarea id="contact-message" placeholder="Message" required className="border border-gray-300 p-3 w-full my-2 rounded" />
            <div className='flex gap-4'>
              <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition">Send</button>
              <button type="button" onClick={() => setContactModalOpen(false)} className="bg-gray-300 p-3 rounded-lg hover:bg-gray-400 transition">Close</button>
            </div>
          </form>
        </div>
      )}

      {isFeedbackModalOpen && (
        <div className="fixed z-[1000] inset-0 flex items-center justify-center bg-[#0008]">
          <form onSubmit={handleFeedbackSubmit} className="text-black bg-white p-6 rounded-lg shadow-lg w-[500px]">
            <h2 className="text-xl font-semibold mb-4">Feedback</h2>

            <label className="block mb-2" htmlFor="feedback-subject">Subject</label>
            <input
              id="feedback-subject"
              type="text"
              placeholder="Subject"
              required
              className="border border-gray-300 p-3 w-full my-2 rounded"
            />

            <label className="block mb-2" htmlFor="feedback-message">Feedback</label>
            <textarea
              id="feedback-message"
              placeholder="Feedback"
              required
              className="border border-gray-300 p-3 w-full my-2 rounded"
            />

            <div className="my-4">
              <label className="block mb-2">Attachment (optional)</label>
              <FileDropZone
                onFileUpload={handleFileUpload}
                maxSize={5}
                acceptedTypes={['image/jpeg', 'image/png', 'image/gif']}
              />
            </div>

            <div className='flex gap-4'>
              <button
                type="submit"
                className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedbackModalOpen(false);
                  setSelectedFile(null);
                }}
                className="bg-gray-300 p-3 rounded-lg hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </form>
        </div>
      )}

      {isTermsModalOpen && (
        <div className="fixed inset-0 bg-[#0008] text-black bg-opacity-50 flex items-center justify-center z-50">
          <div className=" bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Terms and Conditions</h2>
              <span className="close cursor-pointer text-gray-500 hover:text-gray-700" onClick={() => setTermsModalOpen(false)}>&times;</span>
            </div>
            {/* Main Body */}
            <div className="mt-4 overflow-y-auto" style={{ maxHeight: '400px' }}>
                            <p className="text-sm text-gray-700 mb-2">Last Updated: February 18, 2025</p>
                            <p className="mb-4">Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully before using Herd AI, Inc.'s software-as-a-service platform ("Service").</p>

                            <h3 className="font-semibold mt-4">1. Acceptance of Terms</h3>
                            <p>By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.</p>

                            <h3 className="font-semibold mt-4">2. Subscription Terms</h3>
                            <p>2.1. The Service is billed on a subscription basis with a Billing Cycle of thirty (30) days ("Billing Cycle"). You will be billed in advance on a recurring basis every thirty (30) days.</p>
                            <p>2.2. Subscription fees are non-refundable except as specifically provided in these Terms or as required by applicable United States federal or Georgia state law.</p>
                            <p>2.3. We reserve the right to change subscription fees upon thirty (30) days notice. Your continued use of the Service after such changes constitutes acceptance of the new fees.</p>

                            <h3 className="font-semibold mt-4">3. User Account</h3>
                            <p>3.1. You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials.</p>
                            <p>3.2. You are responsible for all activities that occur under your account.</p>

                            <h3 className="font-semibold mt-4">4. Acceptable Use</h3>
                            <p>4.1. You agree not to:</p>
                            <ul className="list-disc list-inside mb-4">
                                <li>Use the Service for any illegal purpose under United States federal law or Georgia state law</li>
                                <li>Violate any applicable laws or regulations</li>
                                <li>Infringe upon the rights of others</li>
                                <li>Attempt to gain unauthorized access to the Service</li>
                                <li>Transmit malware or harmful code</li>
                                <li>Interfere with the proper functioning of the Service</li>
                            </ul>

                            <h3 className="font-semibold mt-4">5. Intellectual Property and Data Ownership</h3>
                            <p>5.1. The Service and its original content, features, and functionality are owned by Herd AI, Inc. and are protected by United States copyright, trademark, patent, trade secret, and other intellectual property laws.</p>
                            <p>5.2. Any and all data, information, content, or materials submitted, uploaded, or transmitted through the Service ("User Data") shall become the exclusive property of Herd AI, Inc. By using the Service, you hereby assign and transfer to Herd AI, Inc. all right, title, and interest in and to all User Data.</p>
                            <p>5.3. Herd AI, Inc. shall have the perpetual, irrevocable right to use, modify, adapt, reproduce, distribute, and exploit any User Data for any purpose, without compensation to you.</p>

                            <h3 className="font-semibold mt-4">6. Data Privacy and Security</h3>
                            <p>6.1. Our Privacy Policy, available at [Privacy Policy URL], describes how we collect, use, and share your information in accordance with applicable United States federal and Georgia state privacy laws.</p>
                            <p>6.2. While we implement reasonable security measures, we cannot guarantee absolute security of your data.</p>

                            <h3 className="font-semibold mt-4">7. Limitation of Liability</h3>
                            <p>7.1. TO THE MAXIMUM EXTENT PERMITTED BY GEORGIA LAW AND UNITED STATES FEDERAL LAW, IN NO EVENT SHALL HERD AI, INC., ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</p>
                            <p>a) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE;</p>
                            <p>b) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE;</p>
                            <p>c) ANY CONTENT OBTAINED FROM THE SERVICE; AND</p>
                            <p>d) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.</p>
                            <p>7.2. IN NO EVENT SHALL OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE EXCEED THE AMOUNT PAID BY YOU FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE INCIDENT.</p>

                            <h3 className="font-semibold mt-4">8. Disclaimer of Warranties</h3>
                            <p>8.1. THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, TO THE MAXIMUM EXTENT PERMITTED BY GEORGIA LAW.</p>
                            <p>8.2. HERD AI, INC. MAKES NO WARRANTY THAT:</p>
                            <p>a) THE SERVICE WILL MEET YOUR REQUIREMENTS</p>
                            <p>b) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE</p>
                            <p>c) THE RESULTS FROM THE SERVICE WILL BE ACCURATE OR RELIABLE</p>

                            <h3 className="font-semibold mt-4">9. Service Modifications</h3>
                            <p>9.1. We reserve the right to modify or discontinue, temporarily or permanently, the Service with or without notice.</p>
                            <p>9.2. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service.</p>

                            <h3 className="font-semibold mt-4">10. Termination</h3>
                            <p>10.1. We reserve the right to terminate or suspend your access to the Service immediately, at any time, with or without cause or notice, and without any liability to you.</p>
                            <p>10.2. Upon termination:</p>
                            <ul className="list-disc list-inside mb-4">
                                <li>a) Your right to use the Service will immediately cease</li>
                                <li>b) We may delete or retain your User Data at our sole discretion</li>
                                <li>c) Any outstanding payment obligations will become immediately due</li>
                                <li>d) Sections regarding intellectual property rights, data ownership, limitation of liability, and governing law shall survive termination</li>
                            </ul>
                            <p>10.3. We shall not be liable to you or any third party for any claims or damages arising from or related to any termination or suspension of the Service.</p>

                            <h3 className="font-semibold mt-4">11. Governing Law and Jurisdiction</h3>
                            <p>11.1. These Terms shall be governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to its conflict of law provisions.</p>
                            <p>11.2. Any dispute arising from or relating to these Terms shall be subject to the exclusive jurisdiction of the state and federal courts located in Georgia, United States.</p>
                            <p>11.3. You agree to submit to the personal jurisdiction of the courts located in Georgia for the purpose of litigating any claims arising from these Terms.</p>

                            <h3 className="font-semibold mt-4">12. Changes to Terms</h3>
                            <p>12.1. We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service.</p>
                            <p>12.2. Your continued use of the Service after such modifications constitutes your acceptance of the modified Terms.</p>

                            <h3 className="font-semibold mt-4">13. Severability</h3>
                            <p>13.1. If any provision of these Terms is found to be unenforceable or invalid under any applicable law, such unenforceability or invalidity shall not render these Terms unenforceable or invalid as a whole, and such provisions shall be deleted without affecting the remaining provisions herein.</p>

                            <h3 className="font-semibold mt-4">14. Contact Information</h3>
                            <p>14.1. For any questions about these Terms, please contact us at support@getherd.ai.</p>

                            <h3 className="font-semibold mt-4">15. Compliance with Laws</h3>
                            <p>15.1. You agree to comply with all applicable federal, state, and local laws and regulations, including but not limited to United States export control laws.</p>
                            <p>15.2. If you access the Service from outside the United States, you do so at your own risk and are responsible for compliance with local laws.</p>
                        </div>
            {/* Footer */}
              <div className="mt-4">
              <button onClick={() => setTermsModalOpen(false)} className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}

