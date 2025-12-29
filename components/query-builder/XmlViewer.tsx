import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const XmlNode: React.FC<{ node: Node }> = ({ node }) => {
    const [expanded, setExpanded] = useState(true);

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (!text) return null;
        return <span className="text-slate-700 break-all">{text}</span>;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as Element;
    const tagName = element.nodeName;
    const attributes = Array.from(element.attributes);
    const hasChildren = element.childNodes.length > 0;
    
    // Check if it only contains a single text node (for compact rendering)
    const isSingleTextNode = element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE;

    return (
        <div className="font-mono text-xs leading-5 ml-2">
            <div className="flex items-start">
                 {/* Expander */}
                 {hasChildren && !isSingleTextNode ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
                        className="mr-1 mt-0.5 text-slate-400 hover:text-slate-600 focus:outline-none shrink-0"
                    >
                        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                 ) : (
                    <span className="w-4 inline-block"></span>
                 )}

                 {/* Tag Start */}
                 <div className="flex-1">
                    <span className="text-blue-700">&lt;{tagName}</span>
                    {attributes.map(attr => (
                        <span key={attr.name} className="ml-1">
                            <span className="text-purple-700">{attr.name}</span>
                            <span className="text-slate-500">=</span>
                            <span className="text-green-600">"{attr.value}"</span>
                        </span>
                    ))}
                    
                    {/* Compact View for Single Text Node */}
                    {isSingleTextNode && (
                        <span>
                            <span className="text-blue-700">&gt;</span>
                            <span className="text-slate-800 font-medium px-0.5">{element.textContent}</span>
                            <span className="text-blue-700">&lt;/{tagName}&gt;</span>
                        </span>
                    )}

                    {/* Standard View */}
                    {!isSingleTextNode && (
                        <>
                            {hasChildren ? (
                                <span className="text-blue-700">&gt;</span>
                            ) : (
                                <span className="text-blue-700"> /&gt;</span>
                            )}

                            {hasChildren && expanded && (
                                <div className="pl-2 border-l border-slate-200 ml-1">
                                    {Array.from(element.childNodes).map((child, i) => (
                                        <XmlNode key={i} node={child} />
                                    ))}
                                </div>
                            )}
                            
                            {hasChildren && !expanded && (
                                <span className="text-slate-400 mx-1 cursor-pointer select-none bg-slate-100 px-1 rounded" onClick={() => setExpanded(true)}>...</span>
                            )}

                            {hasChildren && (
                                <div className={expanded ? "" : "inline"}>
                                    <span className="text-blue-700">&lt;/{tagName}&gt;</span>
                                </div>
                            )}
                        </>
                    )}
                 </div>
            </div>
        </div>
    );
};

const XmlViewer: React.FC<{ xmlString: string }> = ({ xmlString }) => {
    const [xmlDoc, setXmlDoc] = useState<Document | null>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlString, "text/xml");
            const parseError = doc.getElementsByTagName("parsererror");
            if (parseError.length > 0) {
                setError(parseError[0].textContent || "XML Parsing Error");
                setXmlDoc(null);
            } else {
                setXmlDoc(doc);
                setError('');
            }
        } catch (e) {
            setError("Failed to parse XML");
        }
    }, [xmlString]);

    if (error) return <div className="text-red-500 p-4 font-mono text-xs">{error}</div>;
    if (!xmlDoc) return null;

    return (
        <div className="p-4 overflow-auto">
             <XmlNode node={xmlDoc.documentElement} />
        </div>
    );
};

export default XmlViewer;