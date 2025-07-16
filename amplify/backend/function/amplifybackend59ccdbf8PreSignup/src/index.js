/**
 * Lambda function to automatically confirm users during pre-signup trigger
 * This function is triggered before user signup and automatically confirms the user
 */

exports.handler = async (event) => {
    console.log('Pre-signup trigger event:', JSON.stringify(event, null, 2));

    try {
        // Auto-confirm the user
        event.response.autoConfirmUser = true;
        
        // Auto-verify the email if it exists
        if (event.request.userAttributes.email) {
            event.response.autoVerifyEmail = true;
        }
        
        // Auto-verify the phone number if it exists
        if (event.request.userAttributes.phone_number) {
            event.response.autoVerifyPhone = true;
        }

        console.log('User will be auto-confirmed successfully');
        console.log('Modified event:', JSON.stringify(event, null, 2));

        return event;
    } catch (error) {
        console.error('Error in pre-signup trigger:', error);
        throw error;
    }
};
