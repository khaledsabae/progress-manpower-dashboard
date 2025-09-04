// src/components/chatbot-drawer.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, SendHorizonal, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";

// Define the structure for a message
interface Message {
    sender: 'user' | 'bot';
    text: string;
}

// Define the initial welcome message
const initialBotMessage: Message = {
    sender: 'bot',
    text: 'أهلاً بك! أنا مساعدك لمشروع محطة المويه. كيف يمكنني المساعدة اليوم؟'
};

// --- بداية الإضافة: دالة تنظيف المدخلات ---
/**
 * Removes HTML tags from a string to prevent basic XSS attacks.
 * @param text The input text.
 * @returns The sanitized text.
 */
const sanitizeInput = (text: string): string => {
    // Regex to remove HTML tags (basic sanitization)
    return text.replace(/<[^>]*>?/gm, '');
};
// --- نهاية الإضافة ---

export function ChatbotDrawer() {
    const [messages, setMessages] = useState<Message[]>([initialBotMessage]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollViewport = scrollAreaRef.current.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
            if (scrollViewport) {
                setTimeout(() => {
                    scrollViewport.scrollTop = scrollViewport.scrollHeight;
                }, 50); // Small delay to ensure DOM updates
            }
        }
    }, [messages]);

    // Focus input when drawer opens
    useEffect(() => {
        if (isDrawerOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100); // Delay helps ensure drawer animation is complete
        }
    }, [isDrawerOpen]);

    // Handle input change
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput(event.target.value);
    };

    // Handle sending message (with sanitization)
    const handleSendMessage = useCallback(async () => {
        const originalMessage = input.trim(); // الرسالة الأصلية
        if (!originalMessage) return; // لو الرسالة الأصلية فاضية خالص، اخرج

        // --- بداية التعديل: تنظيف الرسالة ---
        const sanitizedMessage = sanitizeInput(originalMessage);
        // لو الرسالة بعد التنضيف بقت فاضية (يعني كانت عبارة عن tags بس مثلاً)
        if (!sanitizedMessage) {
             console.warn('[Chatbot] Message ignored after sanitization (contained only tags?).');
             setInput(''); // فضي الانبوت برضه
             return;
        }
        // --- نهاية التعديل ---

        // عرض رسالة المستخدم الأصلية في الشات
        const newUserMessage: Message = { sender: 'user', text: originalMessage };
        const currentMessages = [...messages, newUserMessage]; // نستخدم الرسالة الأصلية للعرض
        setMessages(currentMessages);

        setInput(''); // فضي الانبوت بعد الإضافة
        setIsLoading(true);
        setError(null);

        try {
            console.log("Sending sanitized message to API:", { message: sanitizedMessage });
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // --- بداية التعديل: إرسال الرسالة المنظفة للـ API ---
                    message: sanitizedMessage,
                    // --- نهاية التعديل ---
                    // بنبعت الـ history زي ما هو (الرسائل المعروضة)
                    // لكن ممكن تفكر تنضف الـ history كمان لو الـ API بيستخدمه بشكل ممكن يكون فيه خطورة
                    history: currentMessages.slice(-10).map(msg => ({ // نبعت structure بسيط للـ history
                        role: msg.sender,
                        content: msg.text // نبعت النص الأصلي المعروض في الـ history حالياً
                    }))
                }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || `حدث خطأ في الشبكة: ${response.status}`);
            }

            const newBotMessage: Message = { sender: 'bot', text: responseData.reply || "لم أتمكن من فهم الرد." };
            setMessages(prevMessages => [...prevMessages, newBotMessage]);

        } catch (err: any) {
            console.error("Error sending/receiving message:", err);
            const friendlyError = `عفواً، حدث خطأ أثناء محاولة الرد. رجاء المحاولة مرة أخرى. (${err.message || 'فشل الاتصال'})`;
            setError(friendlyError);
            const errorMessage: Message = { sender: 'bot', text: friendlyError };
            // Add error message to chat
            setMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus(); // رجع الفوكس للانبوت
        }
    // غيرنا الاعتمادية من input إلى messages عشان لو اليوزر ضغط انتر بسرعة مرتين مثلاً
    }, [messages, input]); // Dependency array updated

    // Handle Enter key press in input field
    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !isLoading) {
            handleSendMessage();
        }
    };

    // Handle clearing chat history
    const handleClearChat = () => {
        setMessages([initialBotMessage]);
        setError(null);
        inputRef.current?.focus();
    };

    return (
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
                <Button variant="outline" size="icon" className="fixed bottom-4 right-4 z-50 rounded-full w-14 h-14 shadow-lg">
                    <Bot className="h-6 w-6" />
                </Button>
            </DrawerTrigger>

            <DrawerContent className="h-[70vh] max-h-[600px] flex flex-col">
                <DrawerHeader className="text-left flex-shrink-0 flex justify-between items-center">
                    <div>
                        <DrawerTitle>مساعد مشروع محطة المويه</DrawerTitle>
                        <DrawerDescription>
                            اسألني أي حاجة عن حالة المشروع (التقدم، الخطة، المواد، العمالة).
                        </DrawerDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleClearChat} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-5 w-5" />
                        <span className="sr-only">مسح المحادثة</span>
                    </Button>
                </DrawerHeader>

                <ScrollArea className="flex-grow p-4 border-t border-b" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex items-start gap-3",
                                    message.sender === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                {message.sender === 'bot' && (
                                    <span className="bg-muted rounded-full p-2 flex-shrink-0">
                                        <Bot className="h-5 w-5" />
                                    </span>
                                )}
                                <div
                                    className={cn(
                                        "rounded-lg px-4 py-2 max-w-[80%] whitespace-pre-wrap break-words",
                                        message.sender === 'user'
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                    )}
                                >
                                    {message.text}
                                </div>
                                {message.sender === 'user' && (
                                    // تعديل بسيط: استخدام ألوان shadcn الافتراضية أكتر
                                    <span className="bg-secondary text-secondary-foreground rounded-full p-2 flex-shrink-0">
                                        <User className="h-5 w-5" />
                                    </span>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start items-center gap-3">
                                <span className="bg-muted rounded-full p-2 flex-shrink-0">
                                    <Bot className="h-5 w-5" />
                                </span>
                                <span className="bg-muted rounded-lg px-4 py-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </span>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {error && (
                    <div className="p-3 text-destructive flex items-center gap-2 text-sm border-t bg-destructive/10 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <DrawerFooter className="pt-4 flex-shrink-0">
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            placeholder="اكتب سؤالك هنا..."
                            value={input}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                            className="flex-grow"
                        />
                        <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()} size="icon">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                            <span className="sr-only">إرسال</span>
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}