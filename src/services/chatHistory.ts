import { supabase } from "@/lib/supabase";

export type ChatThreadType = 'main' | 'side';
export type ChatMessageRole = 'user' | 'assistant';

export const CreateNewThread = async (userEmail: string, type: ChatThreadType, title?: string) => {
    const { data, error } = await supabase
        .from('chat_threads')
        .insert({

            user_email: userEmail,
            type: type,
            title: title
        })
        .select()
        .single();

    if (error) throw error

    return data;
}


export const getThread = async (threadId: string, userEmail?: string) => {
    if (!threadId) {
        let { data, error } = await supabase
            .from('chat_threads')
            .select('*')
            .eq('type', 'main')
            .eq('user_email', userEmail)
            .maybeSingle();

        if (error) throw error;
        return data;
    }
    let { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('id', threadId)
        .maybeSingle();

    if (error) throw error;
    return data;

}

export const GetLatestThread = async (userEmail: string) => {

    let { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;

}


export const saveMessage = async (userEmail: string, threadId: string, role: ChatMessageRole, content: string, metadata: any) => {
    const { data, error } = await supabase
        .from('chat_messages')
        .insert({
            user_email: userEmail,
            thread_id: threadId,
            role: role,
            content: content,
            metadata: metadata
        })
        .select()
        .single();

    if (error) throw error;

    const { error: threadUpdateError } = await supabase.from('chat_threads')
        .update({
            updated_at: new Date().toISOString()
        }).eq('id', threadId);
    if (threadUpdateError) throw threadUpdateError;

    if (role === 'assistant') {
        const { error: titleUpdateError } = await supabase.from('chat_threads')
            .update({
                title: content?.slice(0, 40)
            }).eq('id', threadId)
        if (titleUpdateError) throw titleUpdateError;
    }

    return data;
}

export const updateMessage = async (messageId: string, content: string, metadata: any) => {
    const { data, error } = await supabase
        .from('chat_messages')
        .update({
            content,
            metadata
        })
        .eq('id', messageId)
        .select()
        .single();

    if (error) throw error;
    return data;
}


export const LoadMessages = async (threadid: string) => {
    const { data, error } = await supabase.from('chat_messages')
        .select('*')
        .eq('thread_id', threadid)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
}



export const GetAllUserThreads = async (userEmail: string) => {
    const { data, error } = await supabase.from('chat_threads')
        .select('*')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export const DeleteThread = async (threadId: string) => {

    const { error: messagesError } = await supabase.from('chat_messages')
        .delete()
        .eq('thread_id', threadId);
    if (messagesError) throw messagesError;

    const { data, error } = await supabase.from('chat_threads')
        .delete()
        .eq('id', threadId);

    if (error) throw error;
    return data;
}
