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
import { Badge } from "@/components/ui/badge";
import { Bot, User, SendHorizonal, Loader2, AlertTriangle, Trash2, Zap, TrendingUp, Shield, HelpCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

// --- Forecast Chart Integration ---
import ForecastChart from "@/components/ForecastChart";

// --- Enhanced Command System ---
interface CommandSuggestion {
    command: string;
    description: string;
    icon: React.ReactNode;
    category: 'forecast' | 'risks' | 'system' | 'help';
}

const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
    {
        command: '/forecast method=sma window=7 horizon=4 discipline=hvac',
        description: 'توقع القوى العاملة في نظام التكييف',
        icon: <TrendingUp className="h-4 w-4" />,
        category: 'forecast'
    },
    {
        command: '/forecast method=ema window=7 horizon=4 discipline=firefighting',
        description: 'توقع القوى العاملة في نظام مكافحة الحريق',
        icon: <Shield className="h-4 w-4" />,
        category: 'forecast'
    },
    {
        command: '/detectrisks',
        description: 'تحليل المخاطر والمشاكل المحتملة',
        icon: <AlertTriangle className="h-4 w-4" />,
        category: 'risks'
    },
    {
        command: '/help',
        description: 'عرض جميع الأوامر المتاحة',
        icon: <HelpCircle className="h-4 w-4" />,
        category: 'help'
    },
    {
        command: '/status',
        description: 'حالة النظام والخدمات',
        icon: <Zap className="h-4 w-4" />,
        category: 'system'
    }
];

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
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<CommandSuggestion[]>([]);

    // Forecast data state
    const [forecastData, setForecastData] = useState<any>(null);

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

    // Hide suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Simple Markdown renderer for command responses
    const renderMarkdown = (text: string): React.ReactNode => {
        if (!text.includes('**') && !text.includes('*') && !text.includes('```')) {
            return text;
        }

        // Split by code blocks first
        const parts = text.split(/(```[\s\S]*?```)/g);

        return parts.map((part, index) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                // Code block
                const code = part.slice(3, -3).trim();
                return (
                    <pre key={index} className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-x-auto my-2">
                        <code>{code}</code>
                    </pre>
                );
            } else {
                // Regular text with bold/italic
                const boldItalicRegex = /(\*\*\*|___)(.*?)\1|(\*\*|__)(.*?)\2|(\*|_)(.*?)\5/g;
                const elements: React.ReactNode[] = [];
                let lastIndex = 0;
                let match;

                while ((match = boldItalicRegex.exec(part)) !== null) {
                    // Add text before match
                    if (match.index > lastIndex) {
                        elements.push(part.slice(lastIndex, match.index));
                    }

                    const marker = match[1] || match[3] || match[5];
                    const content = match[2] || match[4] || match[6];

                    if (marker === '***' || marker === '___') {
                        elements.push(<strong key={match.index}><em>{content}</em></strong>);
                    } else if (marker === '**' || marker === '__') {
                        elements.push(<strong key={match.index}>{content}</strong>);
                    } else {
                        elements.push(<em key={match.index}>{content}</em>);
                    }

                    lastIndex = match.index + match[0].length;
                }

                // Add remaining text
                if (lastIndex < part.length) {
                    elements.push(part.slice(lastIndex));
                }

                return <span key={index}>{elements}</span>;
            }
        });
    };

    // Enhanced input change handler with auto-suggestions
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setInput(value);

        // Show suggestions when input starts with '/'
        if (value.startsWith('/')) {
            const filtered = COMMAND_SUGGESTIONS.filter(suggestion =>
                suggestion.command.toLowerCase().includes(value.toLowerCase()) ||
                suggestion.description.includes(value.slice(1))
            );
            setFilteredSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setShowSuggestions(false);
        }
    };

    // Handle suggestion selection
    const handleSuggestionClick = (suggestion: CommandSuggestion) => {
        setInput(suggestion.command);
        setShowSuggestions(false);
        inputRef.current?.focus();
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

            // Handle forecast data
            if (responseData.type === 'forecastResult') {
                setForecastData({ ...responseData.data, discipline: responseData.discipline });
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
        setForecastData(null); // Clear forecast data
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
                                    {message.sender === 'bot' ? renderMarkdown(message.text) : message.text}
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

                {/* Forecast Chart */}
                {forecastData && (
                    <div className="p-4 border-t">
                        <ForecastChart data={forecastData} discipline={forecastData.discipline} locale="ar" />
                    </div>
                )}

                {error && (
                    <div className="p-3 text-destructive flex items-center gap-2 text-sm border-t bg-destructive/10 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <DrawerFooter className="pt-4 flex-shrink-0">
                    {/* Quick Command Buttons */}
                    <div className="mb-3 flex flex-wrap gap-2">
                        {COMMAND_SUGGESTIONS.slice(0, 4).map((suggestion, index) => (
                            <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuggestionClick(suggestion)}
                                disabled={isLoading}
                                className="text-xs h-8"
                            >
                                {suggestion.icon}
                                <span className="ml-1 hidden sm:inline">
                                    {suggestion.command.split(' ')[0]}
                                </span>
                            </Button>
                        ))}
                    </div>

                    {/* Input Area with Suggestions */}
                    <div className="relative">
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <Input
                                    ref={inputRef}
                                    placeholder="اكتب سؤالك أو أمر (مثل /help)..."
                                    value={input}
                                    onChange={handleInputChange}
                                    onKeyPress={handleKeyPress}
                                    disabled={isLoading}
                                    className="pr-10"
                                />

                                {/* Command indicator */}
                                {input.startsWith('/') && (
                                    <Badge
                                        variant="secondary"
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs"
                                    >
                                        Command
                                    </Badge>
                                )}
                            </div>

                            <Button
                                onClick={handleSendMessage}
                                disabled={isLoading || !input.trim()}
                                size="icon"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                                <span className="sr-only">إرسال</span>
                            </Button>
                        </div>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && filteredSuggestions.length > 0 && (
                            <div className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                <div className="p-2">
                                    <div className="text-xs text-gray-500 mb-2 px-2">
                                        اقتراحات الأوامر:
                                    </div>
                                    {filteredSuggestions.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="w-full text-left p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded flex items-start gap-3 transition-colors"
                                        >
                                            <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                                                {suggestion.icon}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                    {suggestion.command}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {suggestion.description}
                                                </div>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="text-xs ml-2 shrink-0"
                                            >
                                                {suggestion.category}
                                            </Badge>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}