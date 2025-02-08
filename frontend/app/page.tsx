'use client';
/*eslint-disable*/
import MessageBoxChat from '@/components/MessageBox';
import { ChatBody } from '@/types/types';
import {
  Button,
  Flex,
  Icon,
  Img,
  Input,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { useState } from 'react';
import { MdAutoAwesome, MdPerson, MdAttachFile } from 'react-icons/md';
import Bg from '../public/img/chat/bg-image.png';

export default function Chat(props: { apiKeyApp: string }) {
  const [inputCode, setInputCode] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<
    { user: string; bot: string }[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const inputColor = useColorModeValue('navy.700', 'white');
  const brandColor = useColorModeValue('brand.500', 'white');
  const textColor = useColorModeValue('navy.700', 'white');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleTranslate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputCode.trim() && !file) {
      alert('Please enter a message or upload a file.');
      return;
    }

    setLoading(true);
    const query = inputCode;

    try {
      const response = await fetch(`./api/langApi?question=${query}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        alert('Something went wrong. Try again.');
        setLoading(false);
        return;
      }

      const data = response.body;
      if (!data) {
        alert('No response from the server.');
        setLoading(false);
        return;
      }

      const reader = data.getReader();
      const decoder = new TextDecoder();
      let outputCode = '';
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        outputCode += decoder.decode(value);
      }

      setChatHistory((prev) => [...prev, { user: inputCode, bot: outputCode }]);
      setInputCode('');
      setFile(null);
    } catch (error) {
      alert('Error processing request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex
      w="100%"
      pt={{ base: '70px', md: '0px' }}
      direction="column"
      position="relative"
    >
      <Img
        src={Bg.src}
        position={'absolute'}
        w="350px"
        left="50%"
        top="50%"
        transform={'translate(-50%, -50%)'}
      />

      <Flex direction="column" mx="auto" w="100%" minH="75vh" maxW="1000px">
        {chatHistory.map((chat, index) => (
          <Flex key={index} direction="column" w="100%" mx="auto" mb="10px">
            <Flex w="100%" justify="flex-start" align="center">
              <Icon
                as={MdPerson}
                width="20px"
                height="20px"
                color={brandColor}
                me="10px"
              />
              <Flex
                p="12px"
                borderRadius="10px"
                border="1px solid"
                borderColor={borderColor}
              >
                <Text color={textColor} fontWeight="600">
                  {chat.user}
                </Text>
              </Flex>
            </Flex>
            <Flex w="100%" justify="flex-end" align="center" mt="5px">
              <MessageBoxChat output={chat.bot} />
              <Icon
                as={MdAutoAwesome}
                width="20px"
                height="20px"
                color="purple.500"
                ms="10px"
              />
            </Flex>
          </Flex>
        ))}
        </Flex>
        <Flex>

        <form onSubmit={handleTranslate}>
          <Flex mt="20px" align="center">
            <Input
              minH="54px"
              border="1px solid"
              borderColor={borderColor}
              borderRadius="45px"
              p="15px 20px"
              fontSize="sm"
              fontWeight="500"
              color={inputColor}
              placeholder="Type your message..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
            />
            <Input
              type="file"
              display="none"
              id="file-upload"
              onChange={handleFileChange}
            />
            <Button
              as="label"
              htmlFor="file-upload"
              variant="outline"
              borderRadius="45px"
              ms="10px"
              h="54px"
            >
              <Icon as={MdAttachFile} />
            </Button>
            <Button
              variant="primary"
              py="20px"
              px="16px"
              fontSize="sm"
              borderRadius="45px"
              ms="10px"
              w="160px"
              h="54px"
              type="submit"
              isLoading={loading}
            >
              Submit
            </Button>
          </Flex>
        </form>
      </Flex>
    </Flex>
  );
}
